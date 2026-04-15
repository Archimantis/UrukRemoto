// -------------------------------------------------------
// MAPA DE TABELAS SINCRONIZÁVEIS — gerado da DDL uruk.ddl
//
// Cada entrada define:
//   columns   — colunas de dados (excluindo campos de sync)
//   pk        — coluna(s) de chave primária
//   required  — colunas obrigatórias no push
//
// Campos de sync presentes em TODAS as tabelas:
//   sync_id, sync_status, version, created_at, updated_at, is_deleted
// -------------------------------------------------------

const SYNC_TABLES = {

  aliases: {
    pk: ['uuid'],
    columns: ['uuid', 'uuid_contraparte', 'nome'],
    required: ['uuid', 'uuid_contraparte', 'nome'],
  },

  categoria: {
    pk: ['uuid'],
    columns: ['uuid', 'descricao'],
    required: ['uuid', 'descricao'],
  },

  contas: {
    pk: ['uuid'],
    columns: ['uuid', 'nome', 'uuid_tipo_conta', 'uuid_instituicao'],
    required: ['uuid', 'nome', 'uuid_tipo_conta', 'uuid_instituicao'],
  },

  contrapartes: {
    pk: ['uuid'],
    columns: ['uuid', 'nome', 'descricao'],
    required: ['uuid', 'nome'],
  },

  cotacao: {
    pk: ['uuid'],
    columns: ['uuid', 'uuid_moeda', 'taxa_compra', 'taxa_venda', 'data_cotacao'],
    required: ['uuid', 'uuid_moeda', 'taxa_compra', 'taxa_venda'],
  },

  detalhecategoria: {
    pk: ['uuid'],
    columns: ['uuid', 'descricao', 'uuid_categoria'],
    required: ['uuid', 'descricao', 'uuid_categoria'],
  },

  instituicoes: {
    pk: ['uuid'],
    columns: ['uuid', 'nome', 'endereco', 'telefone', 'observacao'],
    required: ['uuid', 'nome'],
  },

  // lancamentodetalhe tem PK composta (uuid_lancamento, uuid_detalhecategoria)
  lancamentodetalhe: {
    pk: ['uuid_lancamento', 'uuid_detalhecategoria'],
    pkComposed: true,
    columns: ['uuid_lancamento', 'uuid_detalhecategoria', 'valor', 'uuid_moeda'],
    required: ['uuid_lancamento', 'uuid_detalhecategoria', 'valor', 'uuid_moeda'],
  },

  lancamentos: {
    pk: ['uuid'],
    columns: ['uuid', 'uuid_contas', 'uuid_operacao', 'data',
              'uuid_moeda', 'uuid_contraparte', 'descricao'],
    required: ['uuid', 'uuid_contas', 'uuid_operacao'],
  },

  locais: {
    pk: ['uuid'],
    columns: ['uuid', 'uuid_contraparte', 'latitude', 'longitude',
              'endereco', 'observacao'],
    required: ['uuid', 'uuid_contraparte', 'latitude', 'longitude'],
  },

  moeda: {
    pk: ['uuid'],
    columns: ['uuid', 'codigo', 'nome'],
    required: ['uuid', 'codigo'],
  },

  orcamentocategoria: {
    pk: ['uuid'],
    columns: ['uuid', 'uuid_orcamento', 'uuid_categoria', 'valor', 'uuid_moeda'],
    required: ['uuid', 'uuid_orcamento', 'uuid_categoria'],
  },

  orcamentos: {
    pk: ['uuid'],
    columns: ['uuid', 'nome', 'inicio', 'termino'],
    required: ['uuid', 'nome', 'inicio'],
  },

  tipo_conta: {
    pk: ['uuid'],
    columns: ['uuid', 'descricao'],
    required: ['uuid'],
  },
};

// Campos de sincronização presentes em todas as tabelas
const SYNC_FIELDS = ['sync_id', 'sync_status', 'version', 'created_at', 'updated_at', 'is_deleted'];

module.exports = { SYNC_TABLES, SYNC_FIELDS };
