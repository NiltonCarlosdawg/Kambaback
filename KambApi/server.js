require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');

// Inicializar Express
const app = express();

// Conectar ao MongoDB
connectDB();

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
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toLocaleString('pt-AO')
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

// ==================== TODAS AS ROTAS ====================

// Função auxiliar para validar exportação de router
function safeRouter(requirePath) {
  const r = require(requirePath);

  // Router Express (objeto com função .use)
  if (r && typeof r === 'object' && typeof r.use === 'function') {
    return r;
  }

  // Middleware normal (função)
  if (typeof r === 'function') {
    return r;
  }

  throw new Error(`Arquivo ${requirePath} não exporta um Router válido!`);
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

// Vincular rotas ao Express
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

// Middleware final de erros (sempre o último!)
app.use(errorHandler);

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     API KWANZA - SERVIDOR ONLINE E PRONTO PARA ANGOLA    ║
║                                                          ║
║     Porta: ${PORT.toString().padEnd(45)}║
║     Ambiente: ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║     MongoDB: Conectado                                   ║
║     Hora: ${new Date().toLocaleString('pt-AO').padEnd(43)}║
║                                                          ║
║     O futuro financeiro de Angola começou hoje!          ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('unhandledRejection', (err) => {
  console.error('❌ ERRO NÃO TRATADO:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM recebido. Encerrando com graça...');
  server.close(() => {
    console.log('Servidor encerrado com sucesso. Até já, kamba!');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 Ctrl+C pressionado. Encerrando...');
  server.close(() => {
    console.log('Kwanza foi embora. Volta logo, kamba! 🇦🇴');
    process.exit(0);
  });
});

module.exports = app;
