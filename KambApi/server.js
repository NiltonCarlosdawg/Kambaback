require('dotenv').config();

// ==========================================
// 1. VALIDA AMBIENTE ANTES DE TUDO
// ==========================================
// Certifique-se de que este arquivo existe em src/config/
const { validateEnvironment } = require('./src/config/envValidator');
validateEnvironment(); 

const { iniciarCronJobs } = require('./src/jobs/kambaCronJobs');
iniciarCronJobs();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const prisma = require('./src/lib/prisma');

// ==========================================
// 2. IMPORTA RATE LIMITERS
// ==========================================
const {
  limiteGlobal,
  limiteAuth,
  limiteKamba,
  limiteFinanceiro,
  slowDownLimiter
} = require('./src/middleware/rateLimiter');

// ==========================================
// 3. IMPORTA ROTAS
// ==========================================
const authRoutes = require('./src/routes/auth');
const cartoesRoutes = require('./src/routes/cartoes');
const gastosRoutes = require('./src/routes/gastos');
const categoriasRoutes = require('./src/routes/categorias');
const objetivosRoutes = require('./src/routes/objetivos');
const insightsRoutes = require('./src/routes/insights');
const kambaRoutes = require('./src/routes/kamba');
const noticiasRoutes = require('./src/routes/noticias');
const aiRoutes = require('./src/routes/ai');

// ==========================================
// 4. IMPORTA ERROR HANDLERS
// ==========================================
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// ==========================================
// 5. INICIALIZA APP
// ==========================================
const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 6. MIDDLEWARES DE SEGURANÇA
// ==========================================

// Helmet - Headers de segurança
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// CORS configurado para Produção e Local
app.use(cors({
  origin: process.env.CLIENT_URL || ['http://localhost:5173', 'https://kwanza.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sanitização contra injeções
app.use(mongoSanitize());

// Trust proxy (essencial para Rate Limiting em Heroku/Render/Vercel)
app.set('trust proxy', 1);

// Logger para desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==========================================
// 7. RATE LIMITING GLOBAL
// ==========================================
app.use(limiteGlobal); 
app.use(slowDownLimiter);

// ==========================================
// 8. ROTAS
// ==========================================

// Rota de health check (Pública para monitoramento)
app.get('/health', async (req, res) => {
  try {
    // Verifica se o DB está vivo
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      message: 'KambaPro API está online! 🇦🇴',
      database: 'Conectado',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ success: false, database: 'Offline', error: err.message });
  }
});

// APLICAÇÃO DE ROTAS COM LIMITES ESPECÍFICOS
app.use('/api/auth', limiteAuth, authRoutes);
app.use('/api/kamba', limiteKamba, kambaRoutes);

// OPERAÇÕES FINANCEIRAS
app.use('/api/cartoes', limiteFinanceiro, cartoesRoutes);
app.use('/api/gastos', limiteFinanceiro, gastosRoutes);
app.use('/api/objetivos', limiteFinanceiro, objetivosRoutes);

// DADOS E INSIGHTS
app.use('/api/categorias', categoriasRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/ai', aiRoutes);

// ==========================================
// 9. TRATAMENTO DE ERROS (ORDEM CRÍTICA)
// ==========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ==========================================
// 10. INICIALIZAÇÃO DO SERVIDOR COM PRISMA
// ==========================================
const startServer = async () => {
  try {
    await prisma.$connect();
    
    const server = app.listen(PORT, () => {
      console.log('\n╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║           🇦🇴  KAMBAPRO API - SERVIDOR ONLINE 🇦🇴           ║');
      console.log('║                                                           ║');
      console.log('╠═══════════════════════════════════════════════════════════╣');
      console.log(`║  Ambiente: ${process.env.NODE_ENV?.toUpperCase().padEnd(46)} ║`);
      console.log(`║  Porta: ${PORT.toString().padEnd(49)} ║`);
      console.log(`║  Base de Dados: PostgreSQL (Prisma)                       ║`);
      console.log('╠═══════════════════════════════════════════════════════════╣');
      console.log('║  ✅ Proteção contra Bruteforce: ATIVA                     ║');
      console.log('║  ✅ Sanitização de Dados: ATIVA                           ║');
      console.log('║  ✅ Segurança de Headers: ATIVA                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
    });

    // ==========================================
    // 11. GRACEFUL SHUTDOWN
    // ==========================================
    const shutdown = (signal) => {
      console.log(`\n⚠️  ${signal} recebido. Encerrando servidor...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Conexões encerradas com sucesso.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Erro crítico na inicialização:', error);
    process.exit(1);
  }
};

// ==========================================
// 12. MONITORAMENTO DE ERROS GLOBAIS
// ==========================================
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

startServer();

module.exports = app;