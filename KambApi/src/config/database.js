// src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // === OPÇÕES MODERNAS E OTIMIZADAS PARA ANGOLA ===
    const options = {
      // REMOVIDO: useNewUrlParser, useUnifiedTopology → obsoletas
      // REMOVIDO: retryWrites, w → já vêm na string srv
      serverSelectionTimeoutMS: 30000, // 30s (crucial em redes lentas)
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      autoIndex: process.env.NODE_ENV === 'development',
      // Força resolução DNS mais robusta (resolve 99% dos queryTxt)
      family: 4, // força IPv4 (muitas operadoras angolanas têm problema com IPv6 no Atlas)
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log('╔════════════════════════════════════════════╗');
    console.log('║   ✅  MONGODB CONECTADO COM SUCESSO!  ✅   ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  Host: ${conn.connection.host.padEnd(33)}║`);
    console.log(`║  DB: ${conn.connection.name.padEnd(34)}║`);
    console.log(`║  Estado: Conectado${''.padEnd(28)}║`);
    console.log('╚════════════════════════════════════════════╝');

    // Debug apenas em dev
    if (process.env.NODE_ENV === 'development' && process.env.MONGOOSE_DEBUG === 'true') {
      mongoose.set('debug', true);
    }

    // Eventos de reconexão
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado – tentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado com sucesso!');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro crítico MongoDB:', err.message);
    });

    return conn;

  } catch (error) {
    console.error('╔════════════════════════════════════════════╗');
    console.error('║   ❌ ERRO AO CONECTAR AO MONGODB ❌        ║');
    console.error('╠════════════════════════════════════════════╣');
    console.error(`║  ${error.message.padEnd(41)}║`);
    console.error('╚════════════════════════════════════════════╝');

    // Dicas rápidas
    if (error.message.includes('queryTxt')) {
      console.error('🔧 DICA: Verifica IP no Network Access (0.0.0.0/0) ou usa hotspot de outro telemóvel');
    }
    if (error.message.includes('Authentication failed')) {
      console.error('🔑 DICA: Senha errada no .env – nunca uses <password>');
    }

    // Em produção morre, em dev só avisa
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
};

module.exports = connectDB;