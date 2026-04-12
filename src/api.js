// api.js - API de Sincronização Uruk (versão fundida)
// Endpoints localizados em /api/v1

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ==================== MIDDLEWARE DE SEGURANÇA ====================
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Muitas requisições. Aguarde 15 minutos.' }
});
app.use(globalLimiter);

// Rate limiting para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' }
});

// ==================== CONFIGURAÇÃO DO BANCO DE DADOS ====================
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uruk_db',
  user: process.env.DB_USER || 'uruk',
  password: process.env.DB_PASSWORD || 'uruk123',
});

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const result = await pool.query(
      'SELECT user_uuid FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    req.userId = result.rows[0].user_uuid;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro na autenticação' });
  }
};

// ==================== ENDPOINTS DE AUTENTICAÇÃO ====================

// Registro de usuário
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const uuid = crypto.randomUUID();
    const password_hash = crypto.createHash('sha256').update(password).digest('hex');

    await pool.query(
      'INSERT INTO users (uuid, email, password_hash, nome) VALUES ($1, $2, $3, $4)',
      [uuid, email, password_hash, name || null]
    );

    res.status(201).json({ message: 'Usuário criado com sucesso', uuid });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email já registrado' });
    } else {
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }
});

// Login
app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const password_hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await pool.query(
      'SELECT uuid, email, nome FROM users WHERE email = $1 AND password_hash = $2',
      [email, password_hash]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      'INSERT INTO refresh_tokens (uuid, user_uuid, token, device_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [crypto.randomUUID(), user.rows[0].uuid, accessToken, 'web', expiresAt]
    );

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: user.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro no login' });
  }
});

// Refresh token
app.post('/api/v1/auth/refresh', authenticate, async (req, res) => {
  const newToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    await pool.query(
      'UPDATE refresh_tokens SET token = $1, expires_at = $2 WHERE user_uuid = $3 AND token = $4',
      [newToken, expiresAt, req.userId, req.body.refresh_token]
    );
    res.json({ access_token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao renovar token' });
  }
});

// Logout
app.post('/api/v1/auth/logout', authenticate, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
    res.json({ message: 'Logout realizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro no logout' });
  }
});

// ==================== ENDPOINTS DE SINCRONIZAÇÃO ====================

// Helper para sincronização de tabelas
async function syncTable(req, res, tableName, schema, idField = 'uuid') {
  const { records, device_id } = req.body;
  const userId = req.userId;

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Registros inválidos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const record of records) {
      const { uuid, sync_status, version, ...data } = record;

      // Verificar se o registro existe
      const existing = await client.query(
        `SELECT uuid, version, sync_status FROM ${schema}.${tableName} WHERE ${idField} = $1`,
        [uuid]
      );

      if (existing.rows.length === 0) {
        // Inserir novo registro
        const columns = Object.keys(data);
        const values = columns.map((_, i) => `$${i + 2}`);
        const insertQuery = `
          INSERT INTO ${schema}.${tableName} (${idField}, ${columns.join(', ')}, sync_id, sync_status, version, created_at, updated_at, is_deleted)
          VALUES ($1, ${values.join(', ')}, $1, $2, 1, NOW(), NOW(), 0)
        `;
        await client.query(insertQuery, [uuid, sync_status || 'synced', ...Object.values(data)]);
      } else if (existing.rows[0].version < version) {
        // Atualizar registro existente
        const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 3}`).join(', ');
        const updateQuery = `
          UPDATE ${schema}.${tableName}
          SET ${setClause}, sync_status = $2, version = $3, updated_at = NOW()
          WHERE ${idField} = $1
        `;
        await client.query(updateQuery, [uuid, sync_status || 'synced', version, ...Object.values(data)]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: `${records.length} registros sincronizados com sucesso` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: `Erro ao sincronizar ${tableName}` });
  } finally {
    client.release();
  }
}

// Helper para pull de dados
async function pullTable(req, res, tableName, schema) {
  const userId = req.userId;
  const { last_sync, device_id } = req.query;

  try {
    let query = `SELECT * FROM ${schema}.${tableName} WHERE is_deleted = 0`;
    const params = [];

    if (last_sync) {
      query += ` AND updated_at > $${params.length + 1}`;
      params.push(last_sync);
    }

    query += ` ORDER BY updated_at DESC`;
    const result = await pool.query(query, params);

    res.json({
      table: tableName,
      records: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: `Erro ao buscar dados de ${tableName}` });
  }
}

// ==================== ENDPOINTS POR TABELA ====================

// Tabela: categoria
app.post('/api/v1/sync/categoria', authenticate, (req, res) => syncTable(req, res, 'categoria', 'public'));
app.get('/api/v1/sync/categoria', authenticate, (req, res) => pullTable(req, res, 'categoria', 'public'));

// Tabela: tipo_conta
app.post('/api/v1/sync/tipo_conta', authenticate, (req, res) => syncTable(req, res, 'tipo_conta', 'public'));
app.get('/api/v1/sync/tipo_conta', authenticate, (req, res) => pullTable(req, res, 'tipo_conta', 'public'));

// Tabela: instituicoes
app.post('/api/v1/sync/instituicoes', authenticate, (req, res) => syncTable(req, res, 'instituicoes', 'public'));
app.get('/api/v1/sync/instituicoes', authenticate, (req, res) => pullTable(req, res, 'instituicoes', 'public'));

// Tabela: contas
app.post('/api/v1/sync/contas', authenticate, (req, res) => syncTable(req, res, 'contas', 'public'));
app.get('/api/v1/sync/contas', authenticate, (req, res) => pullTable(req, res, 'contas', 'public'));

// Tabela: contrapartes
app.post('/api/v1/sync/contrapartes', authenticate, (req, res) => syncTable(req, res, 'contrapartes', 'public'));
app.get('/api/v1/sync/contrapartes', authenticate, (req, res) => pullTable(req, res, 'contrapartes', 'public'));

// Tabela: aliases
app.post('/api/v1/sync/aliases', authenticate, (req, res) => syncTable(req, res, 'aliases', 'public'));
app.get('/api/v1/sync/aliases', authenticate, (req, res) => pullTable(req, res, 'aliases', 'public'));

// Tabela: locais
app.post('/api/v1/sync/locais', authenticate, (req, res) => syncTable(req, res, 'locais', 'public'));
app.get('/api/v1/sync/locais', authenticate, (req, res) => pullTable(req, res, 'locais', 'public'));

// Tabela: moeda
app.post('/api/v1/sync/moeda', authenticate, (req, res) => syncTable(req, res, 'moeda', 'public'));
app.get('/api/v1/sync/moeda', authenticate, (req, res) => pullTable(req, res, 'moeda', 'public'));

// Tabela: cotacao
app.post('/api/v1/sync/cotacao', authenticate, (req, res) => syncTable(req, res, 'cotacao', 'public'));
app.get('/api/v1/sync/cotacao', authenticate, (req, res) => pullTable(req, res, 'cotacao', 'public'));

// Tabela: detalhecategoria
app.post('/api/v1/sync/detalhecategoria', authenticate, (req, res) => syncTable(req, res, 'detalhecategoria', 'public'));
app.get('/api/v1/sync/detalhecategoria', authenticate, (req, res) => pullTable(req, res, 'detalhecategoria', 'public'));

// Tabela: lancamentos
app.post('/api/v1/sync/lancamentos', authenticate, (req, res) => syncTable(req, res, 'lancamentos', 'public'));
app.get('/api/v1/sync/lancamentos', authenticate, (req, res) => pullTable(req, res, 'lancamentos', 'public'));

// Tabela: lancamentodetalhe
app.post('/api/v1/sync/lancamentodetalhe', authenticate, (req, res) => syncTable(req, res, 'lancamentodetalhe', 'public'));
app.get('/api/v1/sync/lancamentodetalhe', authenticate, (req, res) => pullTable(req, res, 'lancamentodetalhe', 'public'));

// Tabela: orcamentos
app.post('/api/v1/sync/orcamentos', authenticate, (req, res) => syncTable(req, res, 'orcamentos', 'public'));
app.get('/api/v1/sync/orcamentos', authenticate, (req, res) => pullTable(req, res, 'orcamentos', 'public'));

// Tabela: orcamentocategoria
app.post('/api/v1/sync/orcamentocategoria', authenticate, (req, res) => syncTable(req, res, 'orcamentocategoria', 'public'));
app.get('/api/v1/sync/orcamentocategoria', authenticate, (req, res) => pullTable(req, res, 'orcamentocategoria', 'public'));

// ==================== ENDPOINTS ESPECÍFICOS ====================

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Pull completo (todas as tabelas)
app.get('/api/v1/sync/full', authenticate, async (req, res) => {
  const tables = [
    'categoria', 'tipo_conta', 'instituicoes', 'contas', 'contrapartes',
    'aliases', 'locais', 'moeda', 'cotacao', 'detalhecategoria',
    'lancamentos', 'lancamentodetalhe', 'orcamentos', 'orcamentocategoria'
  ];

  try {
    const results = {};
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM public.${table} WHERE is_deleted = 0`);
      results[table] = result.rows;
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados completos' });
  }
});

// Status da sincronização
app.get('/api/v1/sync/status', authenticate, async (req, res) => {
  const tables = [
    'categoria', 'tipo_conta', 'instituicoes', 'contas', 'contrapartes',
    'aliases', 'locais', 'moeda', 'cotacao', 'detalhecategoria',
    'lancamentos', 'lancamentodetalhe', 'orcamentos', 'orcamentocategoria'
  ];

  try {
    const status = {};
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) as total, 
                SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END) as synced,
                MAX(updated_at) as last_update
         FROM public.${table}`
      );
      status[table] = result.rows[0];
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter status' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

// ==================== INICIALIZAÇÃO ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 uruk-api na porta ${PORT} | ${process.env.NODE_ENV || 'development'}\n`);
  console.log(`Endpoints disponíveis em /api/v1`);
});

module.exports = app;
