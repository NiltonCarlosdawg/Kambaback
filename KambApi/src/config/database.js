// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT) || 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
      minPoolSize: 2,
      retryWrites: true,
      w: 'majority',
      autoIndex: process.env.NODE_ENV === 'development',
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log('╔════════════════════════════════════════════╗');
    console.log('║   ✅  MONGODB CONECTADO COM SUCESSO  ✅    ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  Host: ${conn.connection.host.padEnd(33)}║`);
    console.log(`║  Database: ${conn.connection.name.padEnd(29)}║`);
    console.log(`║  Porta: ${conn.connection.port?.toString().padEnd(32) || 'N/A'.padEnd(32)}║`);
    console.log(`║  Estado: ${conn.connection.readyState === 1 ? 'Conectado' : 'Desconectado'.padEnd(25)}║`);
    console.log('╚════════════════════════════════════════════╝');

    if (process.env.NODE_ENV === 'development' && process.env.MONGOOSE_DEBUG === 'true') {
      mongoose.set('debug', true);
      console.log('🔍 Mongoose Debug: HABILITADO');
    }

    // === EVENTOS DE CONEXÃO ===
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB DESCONECTADO! Tentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB RECONECTADO com sucesso!');
    });

    mongoose.connection.on('close', () => {
      console.log('🔌 Conexão MongoDB FECHADA');
    });

    // === GRACEFUL SHUTDOWN ===
    const gracefulShutdown = async () => {
      await mongoose.connection.close();
      console.log('👋 MongoDB desconectado (encerramento limpo)');
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    return conn;

  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║   ❌  ERRO AO CONECTAR AO MONGODB  ❌      ║');
    console.error('╠════════════════════════════════════════════╣');
    console.error(`║  ${error.message.padEnd(41)}║`);
    console.error('╚════════════════════════════════════════════╝');

    if (error.message.includes('authentication')) {
      console.error('\n💡 Credenciais erradas ou usuário sem permissão!');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      console.error('\n💡 Verifica a internet ou whitelist de IP no Atlas!');
    }

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Funções auxiliares (opcional, mas úteis)
const checkConnection = () => {
  const state = mongoose.connection.readyState;
  const states = { 0: 'Desconectado', 1: 'Conectado', 2: 'Conectando', 3: 'Desconectando' };
  return {
    connected: state === 1,
    state: states[state] || 'Desconhecido',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

const closeConnection = async () => {
  await mongoose.connection.close();
  console.log('✅ Conexão MongoDB fechada manualmente');
};

// === EXPORTA A FUNÇÃO PRINCIPAL DIRETAMENTE (o que o server.js espera) ===
module.exports = connectDB;

// Também exportamos as auxiliares para quem quiser usar
module.exports.checkConnection = checkConnection;
module.exports.closeConnection = closeConnection;