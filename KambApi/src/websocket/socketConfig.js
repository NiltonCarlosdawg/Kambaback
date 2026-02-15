// src/websocket/socketConfig.js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');

// ==========================================
// CONFIGURAÇÃO DO SOCKET.IO
// ==========================================

let io = null;
let pubClient = null;
let subClient = null;


const inicializarSocket = async (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.CLIENT_URL].filter(Boolean)
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6 
  });

  
  if (process.env.REDIS_URL) {
    try {
      pubClient = createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      
      console.log(' Redis Adapter configurado para WebSocket');
    } catch (err) {
      console.warn(' Redis não disponível, usando adapter em memória');
    }
  }

  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.join(`user:${decoded.id}`);
      
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  // Eventos de conexão
  io.on('connection', (socket) => {
    console.log(` Usuário conectado: ${socket.userId} (Socket: ${socket.id})`);

    // Entra na sala pessoal
    socket.join(`user:${socket.userId}`);

    // Evento de confirmação de recebimento
    socket.on('notificacao_recebida', (data) => {
      console.log(` Notificação ${data.notificacaoId} recebida por ${socket.userId}`);
    });

    // Evento de leitura
    socket.on('notificacao_lida', async (data) => {
      try {
        const { marcarLembreteLido } = require('../services/kambaProatividadeService');
        await marcarLembreteLido(data.notificacaoId);
        
        socket.emit('notificacao_atualizada', {
          notificacaoId: data.notificacaoId,
          lido: true
        });
      } catch (err) {
        console.error('[SOCKET] Erro ao marcar como lido:', err.message);
      }
    });

    // Ping de keep-alive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Desconexão
    socket.on('disconnect', (reason) => {
      console.log(` Usuário desconectado: ${socket.userId} (Motivo: ${reason})`);
    });

    // Erros
    socket.on('error', (err) => {
      console.error(`[SOCKET] Erro em ${socket.userId}:`, err.message);
    });
  });

  console.log(' WebSocket inicializado');
  return io;
};


const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO não inicializado. Chame inicializarSocket primeiro.');
  }
  return io;
};


const emitirNotificacao = (usuarioId, tipo, dados) => {
  try {
    const io = getIO();
    io.to(`user:${usuarioId}`).emit('notificacao', {
      tipo,
      dados,
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('[SOCKET] Erro ao emitir notificação:', err.message);
    return false;
  }
};


const broadcastNotificacao = (tipo, dados, excluirUsuarioId = null) => {
  try {
    const io = getIO();
    
    if (excluirUsuarioId) {
      io.except(`user:${excluirUsuarioId}`).emit('notificacao_broadcast', {
        tipo,
        dados,
        timestamp: new Date().toISOString()
      });
    } else {
      io.emit('notificacao_broadcast', {
        tipo,
        dados,
        timestamp: new Date().toISOString()
      });
    }
    return true;
  } catch (err) {
    console.error('[SOCKET] Erro ao fazer broadcast:', err.message);
    return false;
  }
};


const emitirAtualizacaoSaldo = (usuarioId, dados) => {
  return emitirNotificacao(usuarioId, 'ATUALIZACAO_SALDO', dados);
};


const emitirLembrete = (usuarioId, lembrete) => {
  return emitirNotificacao(usuarioId, 'NOVO_LEMBRETE', lembrete);
};

/**
 * Emite alerta de gasto alto
 */
const emitirAlertaGasto = (usuarioId, dados) => {
  return emitirNotificacao(usuarioId, 'ALERTA_GASTO_ALTO', dados);
};

/**
 * Emite progresso de objetivo
 */
const emitirProgressoObjetivo = (usuarioId, dados) => {
  return emitirNotificacao(usuarioId, 'PROGRESSO_OBJETIVO', dados);
};

/**
 * Emite notificação de sistema
 */
const emitirNotificacaoSistema = (usuarioId, mensagem, tipo = 'info') => {
  return emitirNotificacao(usuarioId, 'NOTIFICACAO_SISTEMA', {
    mensagem,
    tipo, // 'info', 'success', 'warning', 'error'
    id: `sys_${Date.now()}`
  });
};

/**
 * Verifica se usuário está online
 */
const isUsuarioOnline = (usuarioId) => {
  try {
    const io = getIO();
    const sockets = io.sockets.adapter.rooms.get(`user:${usuarioId}`);
    return sockets && sockets.size > 0;
  } catch (err) {
    return false;
  }
};

/**
 * Obtém estatísticas de conexões
 */
const getEstatisticas = () => {
  try {
    const io = getIO();
    return {
      conexoesTotais: io.engine.clientsCount,
      salas: Array.from(io.sockets.adapter.rooms.keys()).length
    };
  } catch (err) {
    return { conexoesTotais: 0, salas: 0 };
  }
};

module.exports = {
  inicializarSocket,
  getIO,
  emitirNotificacao,
  broadcastNotificacao,
  emitirAtualizacaoSaldo,
  emitirLembrete,
  emitirAlertaGasto,
  emitirProgressoObjetivo,
  emitirNotificacaoSistema,
  isUsuarioOnline,
  getEstatisticas
};