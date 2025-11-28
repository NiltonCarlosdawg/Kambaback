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
app.use(
  helmet({
    contentSecurityPolicy: false // permite imagens externas (notícias)
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || ['http://localhost:3000', 'https://kwanza.app'],
    credentials: true
  })
);

// Rate Limiting Global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 120 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas requisições, kamba! Espera um pouco e tenta de novo 😎'
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==================== HEALTH CHECKS ====================
app.get('/', (req, res) => {
  res.json({
    message: 'API Kwanza - A Tua Gestão Financeira Angolana 🇦🇴',
    version: '2.0.0 (PostgreSQL)',
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
      database: 'PostgreSQL conectado',
      usersInDB: userCount,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      ambiente: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      database: 'PostgreSQL desconectado',
      error: err.message
    });
  }
});

// ==================== TESTE RÁPIDO DO BANCO ====================
app.get('/api/test-db', async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({
      success: true,
      message: '✅ PostgreSQL + Prisma conectado com sucesso!',
      totalUsers: count,
      time: new Date().toLocaleString('pt-AO')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Falha na conexão com PostgreSQL',
      error: error.message
    });
  }
});

// ==================== TODAS AS ROTAS (vamos importar com segurança) ====================
function safeRouter(requirePath) {
  try {
    const r = require(requirePath);
    if (r && typeof r === 'object' && typeof r.use === 'function') return r;
    if (typeof r === 'function') return r;
    throw new Error('Não é um router válido');
  } catch (err) {
    console.error(`❌ Erro ao carregar rota: ${requirePath} →`, err.message);
    // Retorna um router vazio pra não quebrar o servidor
    return express.Router().get('/', (req, res) => res.status(503).json({ error: 'Rota em manutenção' }));
  }
}

// Import seguro de todas as rotas
const authRoutes       = safeRouter('./src/routes/auth');
const cartoesRoutes    = safeRouter('./src/routes/cartoes');
const gastosRoutes     = safeRouter('./src/routes/gastos');
const categoriasRoutes = safeRouter('./src/routes/categorias');
const objetivosRoutes  = safeRouter('./src/routes/objetivos');
const insightsRoutes   = safeRouter('./src/routes/insights');
const kambaRoutes      = safeRouter('./src/routes/kamba');
const noticiasRoutes   = safeRouter('./src/routes/noticias');

// Vincular rotas
app.use('/api/auth',       authRoutes);
app.use('/api/cartoes',    cartoesRoutes);
app.use('/api/gastos',     gastosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/objetivos',  objetivosRoutes);
app.use('/api/insights',   insightsRoutes);
app.use('/api/kamba',      kambaRoutes);
app.use('/api/noticias',   noticiasRoutes);

// ==================== 404 & ERROS GLOBAIS ====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada, kamba! Verifica o caminho ou fala com o Kamba 😏'
  });
});

app.use(errorHandler);

// ==================== INICIAR SERVIDOR COM CONEXÃO AO POSTGRES ====================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Testa conexão com Postgres + Prisma
    await prisma.$connect();
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║     API KWANZA - SERVIDOR ONLINE COM POSTGRESQL! 🇦🇴     ║');
    console.log('║                                                          ║');
    console.log(`║     Porta: ${PORT.toString().padEnd(45)}║`);
    console.log(`║     Ambiente: ${(process.env.NODE_ENV || 'development').padEnd(38)}║`);
    console.log(`║     Banco: PostgreSQL + Prisma (Local)                  ║`);
    console.log(`║     Hora: ${new Date().toLocaleString('pt-AO').padEnd(43)}║`);
    console.log('║                                                          ║');
    console.log('║     O futuro financeiro de Angola começou AGORA MESMO!   ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando → http://localhost:${PORT}`);
      console.log(`✅ Teste o banco → http://localhost:${PORT}/api/test-db\n`);
    });

  } catch (error) {
    console.error('❌ ERRO CRÍTICO AO CONECTAR AO POSTGRESQL:');
    console.error(error.message);
    process.exit(1);
  }
};

// Inicia tudo
startServer();

// ==================== GRACEFUL SHUTDOWN ====================
process.on('unhandledRejection', (err) => {
  console.error('❌ ERRO NÃO TRATADO:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM recebido. Fechando conexões...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n👋 Ctrl+C pressionado. Encerrando com graça...');
  await prisma.$disconnect();
  console.log('PostgreSQL desconectado. Até já, kamba! 🇦🇴');
  process.exit(0);
});

module.exports = app;