```markdown
# 🚀 Uruk API - Documentação Oficial

API de sincronização para o aplicativo Uruk - Gestão Financeira. Desenvolvida com Node.js, Express e PostgreSQL.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Autenticação](#autenticação)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Autenticação](#endpoints-de-autenticação)
  - [Sincronização - Push](#sincronização-push-envio)
  - [Sincronização - Pull](#sincronização-pull-busca)
  - [Utilitários](#endpoints-utilitários)
- [Modelos de Dados](#modelos-de-dados)
- [Códigos de Erro](#códigos-de-erro)
- [Rate Limiting](#rate-limiting)
- [Exemplos de Uso](#exemplos-de-uso)
- [Segurança](#segurança)

---

## 📖 Visão Geral

A Uruk API é responsável por gerenciar a sincronização de dados financeiros entre o aplicativo móvel e o servidor central. Suporta operações de push (envio) e pull (busca) para 14 tabelas principais, com controle de versão e status de sincronização.

### Tecnologias

- **Runtime**: Node.js
- **Framework**: Express.js
- **Banco de Dados**: PostgreSQL
- **Autenticação**: Token Bearer (UUID v4)
- **Segurança**: Helmet, CORS, Rate Limiting

### Pré-requisitos

- Node.js 14+
- PostgreSQL 12+
- npm ou yarn

---

## ⚙️ Configuração

### 1. Instalação

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/uruk-api.git
cd uruk-api

# Instalar dependências
npm install

# Copiar arquivo de configuração
cp .env.example .env

# Editar variáveis de ambiente
vi .env
```

### 2. Variáveis de Ambiente

```env
# Servidor
PORT=3000
NODE_ENV=production

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uruk_db
DB_USER=uruk
DB_PASSWORD=uruk123
```

### 3. Executar

```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

---

## 🔐 Autenticação

Todos os endpoints de sincronização requerem um token Bearer no cabeçalho da requisição.

### Obter Token

```bash
POST /api/v1/auth/login
```

### Formato do Token

```
Authorization: Bearer <access_token>
```

### Fluxo de Autenticação

1. **Registrar** → Criar nova conta
2. **Login** → Obter `access_token` e `refresh_token`
3. **Usar token** → Incluir em todas as requisições sincronizadas
4. **Refresh** → Renovar token quando expirar
5. **Logout** → Invalidar token

---

## 📡 Endpoints

### Health Check

Endpoint público para verificar o status da API.

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|--------------|-----------|
| `GET` | `/health` | ❌ | Verifica se a API está online |

**Resposta de sucesso (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T12:32:42.000Z",
  "version": "1.0.0"
}
```

---

### Endpoints de Autenticação

Base: `/api/v1/auth`

| Método | Endpoint | Rate Limit | Descrição |
|--------|----------|------------|-----------|
| `POST` | `/register` | 30/15min | Criar nova conta |
| `POST` | `/login` | 30/15min | Login e obtenção de tokens |
| `POST` | `/refresh` | global | Renovar token de acesso |
| `POST` | `/logout` | global | Logout e invalidação |

#### Registrar Usuário

```http
POST /api/v1/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123",
  "name": "Nome do Usuário"
}
```

**Resposta (201 Created):**
```json
{
  "message": "Usuário criado com sucesso",
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Resposta (200 OK):**
```json
{
  "access_token": "550e8400-e29b-41d4-a716-446655440000",
  "refresh_token": "660e8400-e29b-41d4-a716-446655440001",
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@email.com",
    "nome": "Nome do Usuário"
  }
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "refresh_token": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Resposta (200 OK):**
```json
{
  "access_token": "770e8400-e29b-41d4-a716-446655440002"
}
```

#### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

**Resposta (200 OK):**
```json
{
  "message": "Logout realizado"
}
```

---

### Sincronização - Push (Envio)

Envia dados do cliente para o servidor. Requer autenticação.

**Base:** `/api/v1/sync/`

| Método | Endpoint | Tabela |
|--------|----------|--------|
| `POST` | `/categoria` | categoria |
| `POST` | `/tipo_conta` | tipo_conta |
| `POST` | `/instituicoes` | instituicoes |
| `POST` | `/contas` | contas |
| `POST` | `/contrapartes` | contrapartes |
| `POST` | `/aliases` | aliases |
| `POST` | `/locais` | locais |
| `POST` | `/moeda` | moeda |
| `POST` | `/cotacao` | cotacao |
| `POST` | `/detalhecategoria` | detalhecategoria |
| `POST` | `/lancamentos` | lancamentos |
| `POST` | `/lancamentodetalhe` | lancamentodetalhe |
| `POST` | `/orcamentos` | orcamentos |
| `POST` | `/orcamentocategoria` | orcamentocategoria |

#### Formato da Requisição

```http
POST /api/v1/sync/moeda
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "records": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "cod": "BRL",
      "nome": "Real Brasileiro",
      "sync_status": "synced",
      "version": 1
    }
  ]
}
```

**Resposta (200 OK):**
```json
{
  "message": "1 registros sincronizados com sucesso"
}
```

---

### Sincronização - Pull (Busca)

Busca dados do servidor para o cliente. Requer autenticação.

**Base:** `/api/v1/sync/`

| Método | Endpoint | Tabela |
|--------|----------|--------|
| `GET` | `/categoria` | categoria |
| `GET` | `/tipo_conta` | tipo_conta |
| `GET` | `/instituicoes` | instituicoes |
| `GET` | `/contas` | contas |
| `GET` | `/contrapartes` | contrapartes |
| `GET` | `/aliases` | aliases |
| `GET` | `/locais` | locais |
| `GET` | `/moeda` | moeda |
| `GET` | `/cotacao` | cotacao |
| `GET` | `/detalhecategoria` | detalhecategoria |
| `GET` | `/lancamentos` | lancamentos |
| `GET` | `/lancamentodetalhe` | lancamentodetalhe |
| `GET` | `/orcamentos` | orcamentos |
| `GET` | `/orcamentocategoria` | orcamentocategoria |

#### Formato da Requisição

```http
GET /api/v1/sync/moeda?last_sync=2026-01-01T00:00:00Z
Authorization: Bearer <access_token>
```

**Parâmetros Query:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `last_sync` | string (opcional) | Data ISO para filtrar registros atualizados após este momento |
| `device_id` | string (opcional) | Identificador do dispositivo |

**Resposta (200 OK):**
```json
{
  "table": "moeda",
  "records": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "cod": "BRL",
      "nome": "Real Brasileiro",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-04-12T00:00:00.000Z",
      "is_deleted": 0
    }
  ],
  "count": 1,
  "timestamp": "2026-04-12T12:32:42.000Z"
}
```

---

### Endpoints Utilitários

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|--------------|-----------|
| `GET` | `/api/v1/sync/full` | ✅ | Pull completo de todas as tabelas |
| `GET` | `/api/v1/sync/status` | ✅ | Status da sincronização por tabela |

#### Pull Completo

```http
GET /api/v1/sync/full
Authorization: Bearer <access_token>
```

**Resposta (200 OK):**
```json
{
  "categoria": [...],
  "tipo_conta": [...],
  "instituicoes": [...],
  "contas": [...],
  "contrapartes": [...],
  "aliases": [...],
  "locais": [...],
  "moeda": [...],
  "cotacao": [...],
  "detalhecategoria": [...],
  "lancamentos": [...],
  "lancamentodetalhe": [...],
  "orcamentos": [...],
  "orcamentocategoria": [...]
}
```

#### Status da Sincronização

```http
GET /api/v1/sync/status
Authorization: Bearer <access_token>
```

**Resposta (200 OK):**
```json
{
  "categoria": {
    "total": "25",
    "synced": "25",
    "last_update": "2026-04-12T10:00:00.000Z"
  },
  "moeda": {
    "total": "5",
    "synced": "5",
    "last_update": "2026-04-12T10:00:00.000Z"
  }
}
```

---

## 🗄️ Modelos de Dados

### Campos Comuns

Todas as tabelas possuem os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `uuid` | string (UUID v4) | Identificador único primário |
| `sync_id` | string | ID de sincronização (igual ao uuid) |
| `sync_status` | string | Status: 'synced' ou 'pending' |
| `version` | integer | Número de versão para controle de conflitos |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Última atualização |
| `is_deleted` | integer | 0 = ativo, 1 = deletado |

### Tabela: moeda

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cod` | string (3) | Código da moeda (BRL, USD, EUR) |
| `nome` | string | Nome da moeda |

### Tabela: categoria

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `descricao` | string | Nome da categoria |

### Tabela: contas

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | string | Nome da conta |
| `uuid_tipo_conta` | string (UUID) | Referência ao tipo de conta |
| `uuid_instituicao` | string (UUID) | Referência à instituição |

### Tabela: lancamentos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `uuid_contas` | string (UUID) | Conta de origem/destino |
| `uuid_operacao` | string | 'D' (Débito) ou 'C' (Crédito) |
| `data` | string | Data do lançamento (ISO) |
| `uuid_moeda` | string | Código da moeda (BRL, USD) |
| `uuid_contraparte` | string (UUID) | Contraparte da transação |
| `descricao` | string | Descrição do lançamento |

---

## ⚠️ Códigos de Erro

| Código | Significado | Possível Causa |
|--------|-------------|----------------|
| `400` | Bad Request | Corpo da requisição inválido |
| `401` | Unauthorized | Token não fornecido ou inválido |
| `404` | Not Found | Endpoint não existe |
| `409` | Conflict | Email já registrado |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Erro no servidor |

### Exemplo de Resposta de Erro

```json
{
  "error": "Token não fornecido"
}
```

---

## 🚦 Rate Limiting

A API implementa duas camadas de rate limiting:

| Tipo | Limite | Janela | Endpoints afetados |
|------|--------|--------|---------------------|
| **Global** | 300 requisições | 15 minutos | Todos |
| **Autenticação** | 30 tentativas | 15 minutos | `/api/v1/auth/*` |

**Cabeçalhos de Rate Limit:**
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1775998063
```

---

## 💡 Exemplos de Uso

### 1. Fluxo Completo de Sincronização

```bash
# 1. Login
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@email.com","password":"senha123"}' \
  | jq -r '.access_token')

# 2. Enviar dados (Push)
curl -X POST http://localhost:3000/api/v1/sync/moeda \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "records": [{
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "cod": "BRL",
      "nome": "Real Brasileiro",
      "sync_status": "synced",
      "version": 1
    }]
  }'

# 3. Buscar dados (Pull)
curl -X GET "http://localhost:3000/api/v1/sync/moeda?last_sync=2026-01-01T00:00:00Z" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 4. Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 2. Sincronização Completa

```bash
# Buscar todos os dados de uma vez
curl -X GET http://localhost:3000/api/v1/sync/full \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '.'
```

### 3. Verificar Status

```bash
# Verificar status da sincronização por tabela
curl -X GET http://localhost:3000/api/v1/sync/status \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq '.'
```

---

## 🔒 Segurança

### Proteções Implementadas

- **Helmet.js**: Configura cabeçalhos HTTP seguros
- **CORS**: Configuração restrita de origens
- **Rate Limiting**: Prevenção contra ataques de força bruta
- **Hash de Senhas**: SHA-256 (em produção, usar bcrypt)
- **Token Expiration**: Tokens expiram em 7 dias

### Recomendações para Produção

1. **Use HTTPS** sempre em produção
2. **Altere o rate limiting** conforme necessidade
3. **Substitua SHA-256 por bcrypt** para hash de senhas
4. **Configure CORS** com origens específicas, não `*`
5. **Mantenha o banco de dados** em rede isolada

---

## 📝 Licença

MIT

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório ou contate a equipe de desenvolvimento.

---

**Versão:** 1.0.0  
**Última atualização:** Abril 2026
```

Esta documentação está pronta para ser copiada e colada no seu arquivo `README.md` do GitHub. Ela inclui:

- ✅ Visão geral e tecnologias
- ✅ Configuração e instalação
- ✅ Todos os 35 endpoints documentados
- ✅ Modelos de dados
- ✅ Códigos de erro
- ✅ Rate limiting
- ✅ Exemplos práticos com curl
- ✅ Segurança e recomendações
