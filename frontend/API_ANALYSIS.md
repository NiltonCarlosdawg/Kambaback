# Análise Técnica da API Kwanza Pro

Aqui está a análise detalhada do funcionamento e fluxo da API (Backend) fornecida, que serve como base para esta aplicação Frontend.

## 1. Arquitetura Geral
- **Stack:** Node.js com Express.
- **Database:** PostgreSQL gerido via Prisma ORM.
- **Segurança:** 
  - `helmet` para headers de segurança.
  - `cors` configurado para permitir `kwanza.app` e localhost.
  - `express-rate-limit` global (120 requisições/15min em produção) para evitar DDoS/Spam.
- **Resiliência:** Uso de um wrapper `safeRouter` no `server.js` que impede que a API caia caso um arquivo de rota esteja faltando ou com erro de sintaxe.

## 2. Fluxo de Autenticação (JWT)
O sistema utiliza um padrão robusto de **Access Token** (curta duração) + **Refresh Token** (longa duração).

1.  **Registro (`/auth/register`):**
    - Valida dados complexos (Schema Joi) incluindo `dataNascimento`, `sexo`, `morada`.
    - Hash de senha com `bcrypt`.
    - Gera par de tokens inicial.
2.  **Login (`/auth/login`):**
    - Retorna `accessToken` (15min) e `refreshToken` (7 dias).
    - Define o Refresh Token num Cookie `httpOnly` (segurança contra XSS) e também no corpo da resposta.
    - Atualiza o timestamp `ultimoLogin`.
3.  **Proteção (`middleware/auth.js`):**
    - Verifica o Header `Authorization: Bearer <token>`.
    - Checa no banco se o usuário ainda existe, está ativo e não está bloqueado.
    - **Segurança Extra:** Verifica se a senha foi alterada *depois* da emissão do token (invalida tokens antigos em caso de redefinição de senha).

## 3. O "Cérebro": Kamba AI (`kambaController.js`)
Este é o módulo mais avançado da API. Não é apenas um chat simples; é um agente com **Function Calling**.

**Fluxo da IA:**
1.  **Recebimento:** Usuário envia mensagem.
2.  **Contexto:** O controlador busca o perfil financeiro (renda, idade, risco) no DB.
3.  **Decisão (Groq/Llama 3):** A IA analisa se precisa de dados reais.
    - *Exemplo:* "Quanto gastei este mês?" -> IA decide chamar a tool `getFluxoCaixaMensal`.
4.  **Execução de Tool:** O backend executa a função JavaScript local (agregando dados do Prisma).
5.  **Resposta Final:** O resultado da função volta para a IA, que gera o texto final em linguagem natural (gíria angolana).

## 4. Gestão Financeira (Transações Atômicas)
A API garante a integridade dos dados financeiros usando `prisma.$transaction`.

- **Criar Gasto (`gastosController.js`):**
  - Verifica se o cartão existe.
  - Verifica se há saldo suficiente (se for despesa).
  - Cria o registro na tabela `Gasto`.
  - Atualiza o saldo na tabela `Cartao`.
  - *Tudo isso ocorre numa única transação: ou grava tudo, ou não grava nada.*

## 5. Destaques do Código
- **Notícias com Fallback:** O `noticiasController` tenta buscar do GNews. Se falhar (erro ou limite de API), retorna um array hardcoded de notícias locais, garantindo que a UI nunca fique vazia.
- **Distribuição de Poupança:** O `objetivosController` possui lógica para calcular a "sobra" do mês e distribuir automaticamente entre os objetivos do usuário.
- **Validação:** Uso extensivo de `Joi` garante que dados inválidos (ex: datas passadas para objetivos futuros, valores negativos) nem cheguem ao banco de dados.
