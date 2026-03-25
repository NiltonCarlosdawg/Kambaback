require('dotenv').config();

const { validateEnvironment } = require('./src/config/envValidator');
validateEnvironment();

const http = require('http');
const { inicializarSocket } = require('./src/websocket/socketConfig');
const { iniciarCronJobs } = require('./src/jobs/kambaCronJobs');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const prisma = require('./src/lib/prisma');

// ==========================================
// 2. IMPORTA MIDDLEWARES
// ==========================================
const { limiteAuth } = require('./src/middleware/rateLimiter');

// ==========================================
// 3. IMPORTA ROTAS
// ==========================================
const authRoutes = require('./src/modules/users/routes/auth');
const cartoesRoutes = require('./src/modules/cartoes/routes/cartoes');
const gastosRoutes = require('./src/modules/gastos/routes/gastos');
const categoriasRoutes = require('./src/modules/categorias/routes/categorias');
const objetivosRoutes = require('./src/modules/objetivos/routes/objetivos');
const insightsRoutes = require('./src/modules/insights/routes/insights');
const kambaRoutes = require('./src/modules/kamba/routes/kamba');
const noticiasRoutes = require('./src/modules/noticias/routes/noticias');
const notificacoesRoutes = require('./src/modules/users/routes/notificacoes');
const fundoEmergenciaRoutes = require('./src/modules/objetivos/routes/fundo-emergencia');
const dashboardRoutes = require('./src/modules/users/routes/dashboard');

// ==========================================
// 4. IMPORTA ERROR HANDLERS
// ==========================================
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// ==========================================
// 5. INICIALIZA APP E HTTP SERVER
// ==========================================
const app = express();
const server = http.createServer(app);
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
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:4173'];

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

// Sanitização contra injeções NoSQL
app.use(mongoSanitize());

// Trust proxy (necessário para rate limit por IP atrás de load balancer)
app.set('trust proxy', 1);

// Logger de requests (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==========================================
// 7. HEALTH CHECK
// ==========================================
app.get('/health', async (req, res) => {
  const { getEstatisticas } = require('./src/websocket/socketConfig');

  const healthcheck = {
    success: true,
    message: 'KambaPro API está online! ',
    database: 'verificando...',
    websocket: 'verificando...',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    env: process.env.NODE_ENV || 'development'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.database = 'conectado ';

    try {
      const stats = getEstatisticas();
      healthcheck.websocket = {
        status: 'ativo ',
        conexoesTotais: stats.conexoesTotais,
        salas: stats.salas
      };
    } catch {
      healthcheck.websocket = 'inativo ';
    }

    res.status(200).json(healthcheck);
  } catch (err) {
    healthcheck.success = false;
    healthcheck.database = 'erro ';
    res.status(503).json(healthcheck);
  }
});

// ==========================================
// 8. ROTAS
// ==========================================
app.use('/api/auth', limiteAuth, authRoutes);
app.use('/api/kamba', kambaRoutes);
app.use('/api/cartoes', cartoesRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/objetivos', objetivosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/fundo-emergencia', fundoEmergenciaRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
    console.log('PostgreSQL conectado');

    await inicializarSocket(server);
    console.log('WebSocket inicializado');

    iniciarCronJobs();
    console.log('Cron jobs iniciados');

    server.listen(PORT, () => {
      console.log(`\n Servidor online na porta ${PORT}`);
      console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log('WebSocket ativo em /socket.io/');
      console.log('Rate limiting: APENAS em /api/auth');
      console.log('Notificações em tempo real: ATIVAS\n');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n ${signal} recebido. Encerrando graciosamente...`);

      try {
        const io = require('./src/websocket/socketConfig').getIO();
        await new Promise((resolve) => io.close(resolve));
        console.log('Conexões WebSocket fechadas');
      } catch (err) {
        console.warn('Erro ao fechar WebSocket:', err.message);
      }

      await new Promise((resolve) => server.close(resolve));
      console.log('Servidor HTTP encerrado');

      await prisma.$disconnect();
      console.log('BD desconectada');

      process.exit(0);
    };

    // Força encerramento após 15s se travar
    const forceShutdown = (signal) => {
      shutdown(signal).catch(() => {
        console.error('Forçando encerramento após timeout');
        process.exit(1);
      });
      setTimeout(() => {
        console.error('Timeout no shutdown. Forçando encerramento.');
        process.exit(1);
      }, 15000);
    };

    process.on('SIGTERM', () => forceShutdown('SIGTERM'));
    process.on('SIGINT', () => forceShutdown('SIGINT'));

    // Captura erros não tratados para evitar crashes silenciosos
    process.on('unhandledRejection', (reason, promise) => {
      console.error('UnhandledRejection em:', promise, '\nMotivo:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('UncaughtException:', err);
      forceShutdown('uncaughtException');
    });

  } catch (error) {
    console.error('Erro crítico na inicialização:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };