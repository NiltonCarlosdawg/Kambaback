# Guia de Deploy - KambaPro

## Visão Geral dos Serviços

| Serviço | Plataforma | Plano | Limites Gratuitos |
|---------|------------|-------|-------------------|
| Frontend | Vercel | Free | Ilimitado |
| Banco de Dados | Supabase | Free | 500MB, pausa após 7 dias inatividade |
| Backend | Render (Node.js) | Free | 750h/mês |

---

## 1. Supabase (Banco de Dados PostgreSQL)

### 1.1 Criar Projeto

1. Acesse **https://supabase.com/dashboard**
2. Clique em **"New Project"**
3. Preencha:
   - **Organization**: Sua organisasi vorhanden
   - **Name**: `kambapro` (ou outro nome)
   - **Database Password**: `***REDACTED-SEGURANCA***` (guarde esta senha!)
   - **Region**: `🇺🇸 us-east-1` (ou a mais próxima)
4. Clique **Create new project**
5. Aguarde 2-3 minutos para provisionamento

### 1.2 Obter credenciais

1. Vá em **Project Settings → Database**
2. Copie **Connection string** (formato: `postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres`)
3. Anote as chaves em **Project Settings → API**:
   - `Project URL`
   - `anon public` (key)
   - `service_role` (key) - **NÃO compartilhe**

### 1.3 Executar Migrations

No seu terminal local, execute:

```bash
# Configure a URL do banco (substitua com suas credenciais)
export DATABASE_URL="postgresql://postgres:SUA_SENHA@db.xxx.supabase.co:5432/postgres"

# Execute as migrations
cd KambApi
npx prisma migrate deploy

# Gere o client
npx prisma generate
```

**Ou execute manualmente via SQL Editor no Supabase:**

Copie o conteúdo de cada arquivo em:
- `KambApi/prisma/migrations/20251128230312_init/migration.sql`
- `KambApi/prisma/migrations/*/migration.sql`

Execute-os em **SQL Editor** do Supabase (em ordem).

---

## 2. Frontend (Vercel)

### 2.1 Conectar ao GitHub

1. Acesse **https://vercel.com**
2. Login com GitHub
3. Clique **Add New... → Project**
4. Selecione o repositório do frontend

### 2.2 Configurar Variáveis

Em **Environment Variables**, adicione:

| Variável | Valor |
|---------|-------|
| `VITE_API_URL` | URL do backend (ex: `https://kwanza-api.onrender.com`) |
| `GEMINI_API_KEY` | Sua chave da API (se usada) |

### 2.3 Deploy

1. Clique **Deploy**
2. Aguarde ~3 minutos
3. Pegue a URL gerada (ex: `kwanza-pro-web.vercel.app`)

---

## 3. Backend (Render - Node.js)

### 3.1 Criar Serviço Web

1. Acesse **https://dashboard.render.com**
2. Clique **New → Web Service**
3. Conecte seu repositório GitHub (selecione `Kambaback` - código da API)

### 3.2 Configurações

| Campo | Valor |
|-------|-------|
| Name | `kwanza-api` |
| Environment | `Node` |
| Build Command | `npm install && npx prisma generate` |
| Start Command | `node server.js` |

### 3.3 Variáveis de Ambiente

Adicione em **Environment Variables**:

| Variável | Valor |
|-------|-------|
| `DATABASE_URL` | `postgresql://postgres:SENHA@db.XXX.supabase.co:5432/postgres` |
| `JWT_SECRET` | Gere uma nova: `openssl rand -hex 32` |
| `REFRESH_SECRET` | Gere uma nova: `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Gere uma nova: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_EXPIRES_IN` | `7d` |
| `PORT` | `5000` |
| `CLIENT_URL` | URL do frontend na Vercel |
| `KAMBA_AI_API_KEY` | Sua chave (se usada) |
| `KAMBA_AI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `KAMBA_AI_MODEL` | `mixtral-8x7b-32768` |
| `RATE_LIMIT_GLOBAL_MAX` | `100` |
| `RATE_LIMIT_AUTH_MAX` | `5` |

### 3.4 Deploy

1. Clique **Create Web Service**
2. Aguarde ~5 minutos (build + start)
3. Verifique logs em **Logs**

**Nota**: Render free pausa após 15min inatividade. Para evitar, faça um ping periódicas (use Cronitor ou similar).

---

## 4. Redis (Opcional)

O Redis é usado para rate limiting e WebSocket. Opções gratuitas:

1. **Render Redis** (addon pago, ~$5/mês)
2. **Upstash** (free tier: 10k comandos/dia) - Recomendado

### Upstash Free

1. Acesse **https://upstash.com**
2. Crie database Redis
3. Copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
4. Adicione no Render:
   - `REDIS_HOST`: do host (ex: `xxx.upstash.io`)
   - `REDIS_PORT`: `443`
   - `REDIS_PASSWORD`: token
   - `REDIS_URL`: full URL

---

## 5. Variáveis no Frontend

Atualize o arquivo `.env` do frontend:

```
VITE_API_URL=https://kwanza-api.onrender.com
```

E faça novo deploy na Vercel.

---

## 6. Testes

Após tudo configurado:

1. Teste frontend: Acesse URL da Vercel
2. Teste API: Acesse `https://kwanza-api.onrender.com/api/health`
3. Teste login: Tente autenticar

---

## Troubleshooting

### Erro "Connection refused" no banco
- Verifique se o Supabase permite conexões externas (Settings → Database → Allow IPs)

### Erro 502 no Backend
- Verifique logs no Render
- Confirme porta correta (5000)

### Erro CORS
- Atualize `CLIENT_URL` no backend para URL exata da Vercel

### Projeto Supabase pausado
- Free tier pausa após 7 dias. Faça um ping ou upgrade.

Supabase:***REDACTED-SEGURANCA***