const { query, withTransaction } = require('../db');
const { SYNC_TABLES, SYNC_FIELDS } = require('../db/tables');

// -------------------------------------------------------
// POST /sync/push
//
// Recebe array de registros alterados no Android.
// Cada registro contém os campos de dados + campos de sync.
// Estratégia: last-write-wins por updated_at.
//             Se versão do servidor > versão do cliente → conflito.
// -------------------------------------------------------
const push = async (req, res, next) => {
  try {
    const { device_id, records } = req.body;
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ error: 'records deve ser array não vazio.' });

    const results = { accepted: [], rejected: [], conflicts: [] };

    await withTransaction(async (client) => {
      for (const rec of records) {
        const { table, sync_id, sync_status, version, created_at, updated_at,
                is_deleted, ...data } = rec;

        // Valida tabela
        const cfg = SYNC_TABLES[table];
        if (!cfg) {
          results.rejected.push({ sync_id, reason: `Tabela '${table}' não reconhecida.` });
          continue;
        }

        // Monta a chave primária
        const pkValues = cfg.pk.map(k => data[k]);
        if (pkValues.some(v => v == null)) {
          results.rejected.push({ sync_id, reason: 'Chave primária ausente.' });
          continue;
        }

        // Campos de dados permitidos (sem os campos de sync)
        const dataCols = cfg.columns.filter(c => !cfg.pk.includes(c) && data[c] !== undefined);

        // Verifica se já existe no servidor
        const pkWhere  = cfg.pk.map((k, i) => `${k}=$${i + 1}`).join(' AND ');
        const existing = await client.query(
          `SELECT version, updated_at FROM public.${table} WHERE ${pkWhere}`,
          pkValues
        );

        if (existing.rows.length === 0) {
          // ---- INSERT ----
          const allCols  = [...cfg.pk, ...dataCols,
                            'sync_id', 'sync_status', 'version',
                            'created_at', 'updated_at', 'is_deleted'];
          const allVals  = [...pkValues,
                            ...dataCols.map(c => data[c]),
                            sync_id, sync_status || 'synced',
                            version || 1,
                            created_at, updated_at,
                            is_deleted != null ? is_deleted : 0];
          const ph       = allVals.map((_, i) => `$${i + 1}`).join(', ');

          await client.query(
            `INSERT INTO public.${table} (${allCols.join(', ')}) VALUES (${ph})`,
            allVals
          );
          results.accepted.push({ sync_id, action: 'inserted' });

        } else {
          // ---- UPDATE — verifica conflito ----
          const serverUpdated = new Date(existing.rows[0].updated_at);
          const clientUpdated = new Date(updated_at);

          if (clientUpdated < serverUpdated) {
            results.conflicts.push({
              sync_id,
              reason: 'Versão do servidor é mais recente.',
              server_updated_at: existing.rows[0].updated_at,
              server_version: existing.rows[0].version,
            });
            continue;
          }

          // Cliente vence — aplica update
          const setCols = [...dataCols,
                           'sync_id', 'sync_status', 'version',
                           'updated_at', 'is_deleted'];
          const setVals = [...dataCols.map(c => data[c]),
                           sync_id, sync_status || 'synced',
                           (version || 1),
                           updated_at,
                           is_deleted != null ? is_deleted : 0];
          const setClause = setCols.map((c, i) => `${c}=$${i + 1}`).join(', ');
          const whereClause = cfg.pk.map((k, i) => `${k}=$${setCols.length + i + 1}`).join(' AND ');

          await client.query(
            `UPDATE public.${table} SET ${setClause} WHERE ${whereClause}`,
            [...setVals, ...pkValues]
          );
          results.accepted.push({ sync_id, action: 'updated' });
        }
      }
    });

    res.json({
      message: 'Push concluído.',
      accepted:  results.accepted.length,
      conflicts: results.conflicts.length,
      rejected:  results.rejected.length,
      details: results,
    });
  } catch (err) { next(err); }
};

// -------------------------------------------------------
// GET /sync/pull?since=<ISO>&tables=t1,t2
//
// Retorna todos os registros (inclusive is_deleted=1)
// alterados após o timestamp 'since'.
// O Android aplica is_deleted localmente.
// -------------------------------------------------------
const pull = async (req, res, next) => {
  try {
    const since  = req.query.since;
    const tables = req.query.tables
      ? req.query.tables.split(',').filter(t => SYNC_TABLES[t])
      : Object.keys(SYNC_TABLES);

    if (!since) return res.status(400).json({ error: 'Parâmetro since obrigatório (ISO 8601).' });

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime()))
      return res.status(400).json({ error: 'since inválido — use ISO 8601.' });

    const allRecords = [];

    for (const table of tables) {
      const cfg  = SYNC_TABLES[table];
      if (!cfg) continue;

      // Seleciona todas as colunas (dados + sync)
      const result = await query(
        `SELECT * FROM public.${table}
         WHERE updated_at > $1
         ORDER BY updated_at ASC
         LIMIT 2000`,
        [sinceDate]
      );

      for (const row of result.rows) {
        allRecords.push({ table, ...row });
      }
    }

    // Ordena globalmente por updated_at para o Android processar em ordem
    allRecords.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

    res.json({
      server_time: new Date().toISOString(),
      count: allRecords.length,
      records: allRecords,
    });
  } catch (err) { next(err); }
};

// -------------------------------------------------------
// GET /sync/full?tables=t1,t2&page=1&limit=500
//
// Sincronização inicial completa — retorna todos os
// registros ativos, paginado.
// -------------------------------------------------------
const fullSync = async (req, res, next) => {
  try {
    const tables = req.query.tables
      ? req.query.tables.split(',').filter(t => SYNC_TABLES[t])
      : Object.keys(SYNC_TABLES);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(1000, parseInt(req.query.limit) || 500);
    const offset = (page - 1) * limit;

    const allRecords = [];

    for (const table of tables) {
      if (!SYNC_TABLES[table]) continue;
      const result = await query(
        `SELECT * FROM public.${table}
         WHERE is_deleted = 0
         ORDER BY updated_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      for (const row of result.rows) {
        allRecords.push({ table, ...row });
      }
    }

    res.json({
      server_time: new Date().toISOString(),
      page, limit,
      count: allRecords.length,
      records: allRecords,
    });
  } catch (err) { next(err); }
};

// -------------------------------------------------------
// GET /sync/status
// Retorna quantos registros pendentes existem por tabela.
// Útil para o Android saber se há dados para baixar.
// -------------------------------------------------------
const status = async (req, res, next) => {
  try {
    const tables = Object.keys(SYNC_TABLES);
    const counts = {};

    for (const table of tables) {
      const r = await query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN sync_status='pending' THEN 1 ELSE 0 END) AS pending
         FROM public.${table}`
      );
      counts[table] = {
        total:   parseInt(r.rows[0].total),
        pending: parseInt(r.rows[0].pending || 0),
      };
    }

    res.json({ server_time: new Date().toISOString(), tables: counts });
  } catch (err) { next(err); }
};

module.exports = { push, pull, fullSync, status };
