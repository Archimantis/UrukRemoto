# uruk-api — REST API de Sincronização

API gerada automaticamente a partir da DDL `uruk.ddl`.  
Backend: Node.js + Express + PostgreSQL.

---

## Instalação

```bash
npm install
cp .env.example .env        # configure as credenciais
npm run migrate             # cria tabela users, refresh_tokens e índices de sync
npm run dev                 # desenvolvimento
npm start                   # produção
```

---

## Tabelas sincronizáveis

| Tabela | PK | Campos de dados |
|---|---|---|
| aliases | uuid | uuid_contraparte, nome |
| categoria | uuid | descricao |
| contas | uuid | nome, uuid_tipo_conta, uuid_instituicao |
| contrapartes | uuid | nome, descricao |
| cotacao | uuid | uuid_moeda, taxa_compra, taxa_venda, data_cotacao |
| detalhecategoria | uuid | descricao, uuid_categoria |
| instituicoes | uuid | nome, endereco, telefone, observacao |
| lancamentodetalhe | uuid_lancamento + uuid_detalhecategoria | valor, uuid_moeda |
| lancamentos | uuid | uuid_contas, uuid_operacao, data, uuid_moeda, uuid_contraparte, descricao |
| locais | uuid | uuid_contraparte, latitude, longitude, endereco, observacao |
| moeda | uuid | cod, nome |
| orcamentocategoria | uuid | uuid_orcamento, uuid_categoria, valor, uuid_moeda |
| orcamentos | uuid | nome, inicio, termino |
| tipo_conta | uuid | descricao |

Campos de sync presentes em todas: `sync_id`, `sync_status`, `version`, `created_at`, `updated_at`, `is_deleted`

---

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | /auth/register | — | Cadastro |
| POST | /auth/login | — | Login |
| POST | /auth/refresh | — | Renova token |
| POST | /auth/logout | — | Logout |
| POST | /sync/push | JWT | Android → Servidor |
| GET | /sync/pull?since= | JWT | Servidor → Android (delta) |
| GET | /sync/full | JWT | Sync completa inicial |
| GET | /sync/status | JWT | Contagem por tabela |
| GET | /health | — | Status da API |

---

## Exemplos

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"senha123","device_id":"android-uuid"}'
```

### Push — enviar lançamento criado offline
```bash
curl -X POST http://localhost:3000/sync/push \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "android-uuid",
    "records": [
      {
        "table": "lancamentos",
        "uuid": "novo-uuid-aqui",
        "uuid_contas": "uuid-da-conta",
        "uuid_operacao": "D",
        "data": "2026-03-19",
        "uuid_moeda": "BRL",
        "uuid_contraparte": null,
        "descricao": "Supermercado",
        "sync_id": "sync-device-001",
        "sync_status": "pending",
        "version": 1,
        "created_at": "2026-03-19T10:00:00Z",
        "updated_at": "2026-03-19T10:00:00Z",
        "is_deleted": 0
      }
    ]
  }'
```

### Push — soft delete de uma categoria
```bash
# Basta enviar o registro com is_deleted=1 e updated_at atualizado
{
  "table": "categoria",
  "uuid": "uuid-da-categoria",
  "descricao": "Moradia",
  "sync_id": "sync-del-001",
  "sync_status": "pending",
  "version": 2,
  "created_at": "2026-03-14T00:00:00",
  "updated_at": "2026-03-19T12:00:00Z",
  "is_deleted": 1
}
```

### Pull — buscar novidades desde o último sync
```bash
curl "http://localhost:3000/sync/pull?since=2026-03-18T00:00:00Z" \
  -H "Authorization: Bearer <token>"

# Filtrar apenas algumas tabelas:
curl "http://localhost:3000/sync/pull?since=2026-03-18T00:00:00Z&tables=lancamentos,lancamentodetalhe" \
  -H "Authorization: Bearer <token>"
```

### Resposta do pull
```json
{
  "server_time": "2026-03-19T15:00:00Z",
  "count": 3,
  "records": [
    {
      "table": "lancamentos",
      "uuid": "...",
      "uuid_contas": "...",
      "uuid_operacao": "D",
      "data": "2026-03-19",
      "uuid_moeda": "BRL",
      "descricao": "Supermercado",
      "sync_id": "...",
      "sync_status": "synced",
      "version": 1,
      "created_at": "...",
      "updated_at": "...",
      "is_deleted": 0
    }
  ]
}
```

### Status
```bash
curl "http://localhost:3000/sync/status" \
  -H "Authorization: Bearer <token>"
```

---

## Fluxo de Sync no Android

```
App inicia / reconecta
  ↓
1. GET /sync/pull?since=<ultimo_sync_salvo>
   → aplica registros no Room (incluindo is_deleted=1)
  ↓
2. POST /sync/push com registros locais com sync_status='pending'
   → verifica conflicts na resposta
   → marca como sync_status='synced' os accepted
  ↓
3. Salva server_time como novo ultimo_sync
  ↓
4. Repete via WorkManager a cada 15 min ou ao reconectar
```

---

## Resolução de Conflitos

A estratégia é **last-write-wins por `updated_at`**:
- Se `updated_at` do cliente > servidor → cliente vence, servidor é atualizado
- Se `updated_at` do cliente < servidor → conflito reportado, servidor mantém sua versão
- O Android deve re-baixar via pull para obter a versão do servidor nos conflitos
