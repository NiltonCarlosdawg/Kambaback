require('dotenv').config();

// ==========================================
// 1. VALIDA AMBIENTE ANTES DE TUDO
// ==========================================
const { validateEnvironment } = require('./src/config/envValidator');
validateEnvironment(); 

const { iniciarCronJobs } = require('./src/jobs/kambaCronJobs');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const prisma = require('./src/lib/prisma');

// ==========================================
// 2. IMPORTA APENAS O RATE LIMITER DE AUTH
// ==========================================
const { limiteAuth } = require('./src/middleware/rateLimiter');

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
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// CORS
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.CLIENT_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Não permitido por CORS'), false);
    }
  },
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

// Trust proxy
app.set('trust proxy', 1);

// Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==========================================
// 8. ROTAS
// ==========================================

app.get('/health', async (req, res) => {
  const healthcheck = {
    success: true,
    message: 'KambaPro API está online! 🇦🇴',
    database: 'verificando...',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.database = 'conectado ✅';
    res.status(200).json(healthcheck);
  } catch (err) {
    healthcheck.success = false;
    res.status(503).json(healthcheck);
  }
});

// APLICAÇÃO DE ROTAS - APENAS AUTH TEM RATE LIMIT
app.use('/api/auth', limiteAuth, authRoutes);        // ✅ Com proteção (5 tentativas/15min)
app.use('/api/kamba', kambaRoutes);                   // ❌ Sem rate limit
app.use('/api/cartoes', cartoesRoutes);               // ❌ Sem rate limit
app.use('/api/gastos', gastosRoutes);                 // ❌ Sem rate limit
app.use('/api/objetivos', objetivosRoutes);           // ❌ Sem rate limit
app.use('/api/categorias', categoriasRoutes);         // ❌ Sem rate limit
app.use('/api/insights', insightsRoutes);             // ❌ Sem rate limit
app.use('/api/noticias', noticiasRoutes);             // ❌ Sem rate limit
app.use('/api/ai', aiRoutes);                         // ❌ Sem rate limit

// ==========================================
// 9. TRATAMENTO DE ERROS
// ==========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ==========================================
// 10. INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL conectado');
    
    iniciarCronJobs();
    
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Servidor online na porta ${PORT}`);
      console.log('🔒 Rate limiting: APENAS em /api/auth (login/register)');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n⚠️ ${signal} recebido. Encerrando...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    process.exit(1);
  }
};

startServer();
module.exports = app;