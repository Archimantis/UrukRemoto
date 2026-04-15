require('dotenv').config();
const { pool } = require('./index');

// Adiciona índices de sincronização em todas as tabelas da DDL uruk.
// NÃO recria as tabelas existentes — apenas complementa com índices e
// adiciona a tabela de controle de usuários/dispositivos.

const migrations = `

-- -------------------------------------------------------
-- Tabela de usuários (autenticação)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  uuid          text PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nome          text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- Tabela de refresh tokens por dispositivo
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  uuid       text PRIMARY KEY,
  user_uuid  text NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
  token      text UNIQUE NOT NULL,
  device_id  text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Índices de sincronização (updated_at + is_deleted)
-- em todas as tabelas sincronizáveis.
-- Usados nas queries de pull (delta por timestamp).
-- -------------------------------------------------------

-- aliases
CREATE INDEX IF NOT EXISTS idx_aliases_updated_at   ON public.aliases(updated_at);
CREATE INDEX IF NOT EXISTS idx_aliases_is_deleted    ON public.aliases(is_deleted);
CREATE INDEX IF NOT EXISTS idx_aliases_sync_status   ON public.aliases(sync_status);

-- categoria
CREATE INDEX IF NOT EXISTS idx_categoria_updated_at  ON public.categoria(updated_at);
CREATE INDEX IF NOT EXISTS idx_categoria_is_deleted   ON public.categoria(is_deleted);

-- contas
CREATE INDEX IF NOT EXISTS idx_contas_updated_at     ON public.contas(updated_at);
CREATE INDEX IF NOT EXISTS idx_contas_is_deleted      ON public.contas(is_deleted);

-- contrapartes
CREATE INDEX IF NOT EXISTS idx_contrapartes_updated_at ON public.contrapartes(updated_at);
CREATE INDEX IF NOT EXISTS idx_contrapartes_is_deleted  ON public.contrapartes(is_deleted);

-- cotacao
CREATE INDEX IF NOT EXISTS idx_cotacao_updated_at    ON public.cotacao(updated_at);
CREATE INDEX IF NOT EXISTS idx_cotacao_is_deleted     ON public.cotacao(is_deleted);

-- detalhecategoria
CREATE INDEX IF NOT EXISTS idx_detalhecategoria_updated_at ON public.detalhecategoria(updated_at);
CREATE INDEX IF NOT EXISTS idx_detalhecategoria_is_deleted  ON public.detalhecategoria(is_deleted);

-- instituicoes
CREATE INDEX IF NOT EXISTS idx_instituicoes_updated_at ON public.instituicoes(updated_at);
CREATE INDEX IF NOT EXISTS idx_instituicoes_is_deleted  ON public.instituicoes(is_deleted);

-- lancamentodetalhe
CREATE INDEX IF NOT EXISTS idx_lancamentodetalhe_updated_at ON public.lancamentodetalhe(updated_at);
CREATE INDEX IF NOT EXISTS idx_lancamentodetalhe_is_deleted  ON public.lancamentodetalhe(is_deleted);

-- lancamentos
CREATE INDEX IF NOT EXISTS idx_lancamentos_updated_at ON public.lancamentos(updated_at);
CREATE INDEX IF NOT EXISTS idx_lancamentos_is_deleted  ON public.lancamentos(is_deleted);

-- locais
CREATE INDEX IF NOT EXISTS idx_locais_updated_at     ON public.locais(updated_at);
CREATE INDEX IF NOT EXISTS idx_locais_is_deleted      ON public.locais(is_deleted);

-- orcamentocategoria
CREATE INDEX IF NOT EXISTS idx_orcamentocategoria_updated_at ON public.orcamentocategoria(updated_at);
CREATE INDEX IF NOT EXISTS idx_orcamentocategoria_is_deleted  ON public.orcamentocategoria(is_deleted);

-- orcamentos
CREATE INDEX IF NOT EXISTS idx_orcamentos_updated_at ON public.orcamentos(updated_at);
CREATE INDEX IF NOT EXISTS idx_orcamentos_is_deleted  ON public.orcamentos(is_deleted);

-- tipo_conta
CREATE INDEX IF NOT EXISTS idx_tipo_conta_updated_at ON public.tipo_conta(updated_at);
CREATE INDEX IF NOT EXISTS idx_tipo_conta_is_deleted  ON public.tipo_conta(is_deleted);

-- moeda (índices já existem na DDL original, criação idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_moeda_codigo     ON public.moeda(codigo);
CREATE INDEX        IF NOT EXISTS idx_moeda_updated_at ON public.moeda(updated_at);
CREATE INDEX        IF NOT EXISTS idx_moeda_is_deleted ON public.moeda(is_deleted);

-- refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON public.refresh_tokens(user_uuid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token  ON public.refresh_tokens(token);
`;

async function migrate() {
  console.log('Iniciando migração uruk-api...');
  try {
    await pool.query(migrations);
    console.log('Migração concluída.');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
