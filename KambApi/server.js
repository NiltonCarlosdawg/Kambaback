// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./src/lib/prisma');
const errorHandler = require('./src/middleware/errorHandler');

// Inicializar Express
const app = express();

// ==================== SEGURANÇA & PERFORMANCE ====================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || ['http://localhost:3000', 'https://kwanza.app'], credentials: true }));

// Rate Limiting Global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 120 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições, kamba! Espera um pouco e tenta de novo' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==================== HEALTH CHECKS ====================
app.get('/', (req, res) => {
  res.json({
    message: 'API Kwanza - A Tua Gestão Financeira Angolana',
    version: '2.0.0 (PostgreSQL + Groq)',
    status: 'online',
    database: 'PostgreSQL + Prisma',
    timestamp: new Date().toLocaleString('pt-AO')
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: 'OK',
      usersInDB: userCount,
      uptime: `${Math.floor(process.uptime())}s`,
      ambiente: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({
      success: true,
      message: 'PostgreSQL + Prisma conectado com sucesso!',
      totalUsers: count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Falha na conexão com PostgreSQL', error: error.message });
  }
});

// ==================== ROTAS COM SAFE IMPORT ====================
function safeRouter(path) {
  try {
    const r = require(path);
    return (r && typeof r.use === 'function') ? r : r;
  } catch (err) {
    console.error(`Erro ao carregar rota: ${path}`, err.message);
    return express.Router().get('/', (req, res) => res.status(503).json({ error: 'Rota em manutenção' }));
  }
}

// Import seguro
const authRoutes       = safeRouter('./src/routes/auth');
const cartoesRoutes    = safeRouter('./src/routes/cartoes');
const gastosRoutes     = safeRouter('./src/routes/gastos');
const categoriasRoutes = safeRouter('./src/routes/categorias');
const objetivosRoutes  = safeRouter('./src/routes/objetivos');
const insightsRoutes   = safeRouter('./src/routes/insights');
const kambaRoutes      = safeRouter('./src/routes/kamba');
const noticiasRoutes   = safeRouter('./src/routes/noticias');

// Vincular rotas (ORDEM IMPORTA!)
app.use('/api/auth',       authRoutes);
app.use('/api/cartoes',    cartoesRoutes);
app.use('/api/gastos',     gastosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/objetivos',  objetivosRoutes);
app.use('/api/insights',   insightsRoutes);
app.use('/api/kamba',      kambaRoutes);      // ← CORRETO!
app.use('/api/noticias',   noticiasRoutes);

// 404 — SEMPRE O ÚLTIMO
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada, kamba! Verifica o caminho ou fala com o Kamba'
  });
});

app.use(errorHandler);

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     API KWANZA - SERVIDOR ONLINE COM POSTGRESQL!       ║');
    console.log('║     Groq + Llama 3.1 70B ativado | Kamba IA Turbo      ║');
    console.log(`║     Porta: ${PORT.toString().padEnd(45)}║`);
    console.log(`║     Ambiente: ${(process.env.NODE_ENV || 'development').padEnd(38)}║`);
    console.log(`║     Hora: ${new Date().toLocaleString('pt-AO').padEnd(43)}║`);
    console.log('║     O futuro financeiro de Angola começou AGORA MESMO!   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando → http://localhost:${PORT}`);
      console.log(`Teste o banco → http://localhost:${PORT}/api/test-db`);
      console.log(`Fala com o Kamba → POST http://localhost:${PORT}/api/kamba\n`);
    });
  } catch (error) {
    console.error('ERRO CRÍTICO AO CONECTAR AO POSTGRESQL:', error.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('PostgreSQL desconectado. Até já, kamba!');
  process.exit(0);
});

module.exports = app;