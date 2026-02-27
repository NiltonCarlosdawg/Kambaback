require('dotenv').config();

// ==========================================
// 1. VALIDA AMBIENTE ANTES DE TUDO
// ==========================================
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
const notificacoesRoutes = require('./src/routes/notificacoes');
const fundoEmergenciaRoutes = require('./src/routes/fundo-emergencia');


// ==========================================
// 4. IMPORTA ERROR HANDLERS
// ==========================================
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// ==========================================
// 5. INICIALIZA APP E HTTP SERVER
// ==========================================
const app = express();
const server = http.createServer(app); // Criar servidor HTTP para WebSocket
const PORT = process.env.PORT || 5000;

// ==========================================
// 6. MIDDLEWARES DE SEGURANÇA
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// CORS - Atualizado para suportar WebSocket
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

// Sanitização contra injeções
app.use(mongoSanitize());

// Trust proxy
app.set('trust proxy', 1);

// Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==========================================
// 7. HEALTH CHECK E STATUS
// ==========================================

app.get('/health', async (req, res) => {
  const { getEstatisticas, isUsuarioOnline } = require('./src/websocket/socketConfig');
  const healthcheck = {
    success: true,
    message: 'KambaPro API está online! ',
    database: 'verificando...',
    websocket: 'verificando...',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.database = 'conectado ';
    
    // Verifica status do WebSocket
    try {
      const stats = getEstatisticas();
      healthcheck.websocket = {
        status: 'ativo ',
        conexoesTotais: stats.conexoesTotais,
        salas: stats.salas
      };
    } catch (wsErr) {
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

// APLICAÇÃO DE ROTAS - APENAS AUTH TEM RATE LIMIT
app.use('/api/auth', limiteAuth, authRoutes);       
app.use('/api/kamba', kambaRoutes);                  
app.use('/api/cartoes', cartoesRoutes);               
app.use('/api/gastos', gastosRoutes);                 
app.use('/api/objetivos', objetivosRoutes);           
app.use('/api/categorias', categoriasRoutes);         
app.use('/api/insights', insightsRoutes);             
app.use('/api/noticias', noticiasRoutes);             
app.use('/api/ai', aiRoutes);                      
app.use('/api/notificacoes', notificacoesRoutes);    
app.use('/api/fundo-emergencia', fundoEmergenciaRoutes);

// ==========================================
// 9. TRATAMENTO DE ERROS
// ==========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ==========================================
// 10. INICIALIZAÇÃO DO SERVIDOR COM WEBSOCKET
// ==========================================
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log(' PostgreSQL conectado');
    
    // Inicializa WebSocket antes de iniciar o servidor HTTP
    await inicializarSocket(server);
    console.log(' WebSocket inicializado para notificações em tempo real');
    
    // Inicia cron jobs (agora pode usar WebSocket também)
    iniciarCronJobs();
    
    server.listen(PORT, () => {
      console.log(`\n Servidor online na porta ${PORT}`);
      console.log(' WebSocket ativo em /socket.io/');
      console.log(' Rate limiting: APENAS em /api/auth (login/register)');
      console.log(' Notificações em tempo real: ATIVAS');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n ${signal} recebido. Encerrando graciosamente...`);
      
      // Fecha conexões WebSocket primeiro
      const io = require('./src/websocket/socketConfig').getIO();
      io.close(() => {
        console.log(' Conexões WebSocket fechadas');
        
        server.close(async () => {
          await prisma.$disconnect();
          console.log(' Servidor encerrado com sucesso');
          process.exit(0);
        });
      });
      
      // Força encerramento após 10s se travar
      setTimeout(() => {
        console.error(' Forçando encerramento após timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error(' Erro crítico na inicialização:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };