// src/utils/socketClient.js (Frontend)
import { io } from 'socket.io-client';
import { getToken } from './auth';

class SocketClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const token = getToken();
    
    this.socket = io(import.meta.env.VITE_API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.setupListeners();
    return this.socket;
  }

  setupListeners() {
    // Conexão estabelecida
    this.socket.on('connect', () => {
      console.log('🟢 WebSocket conectado');
      this.reconnectAttempts = 0;
    });

    // Notificações pessoais
    this.socket.on('notificacao', (data) => {
      console.log('🔔 Nova notificação:', data);
      this.showNotification(data);
      
      // Confirma recebimento
      this.socket.emit('notificacao_recebida', {
        notificacaoId: data.id
      });
    });

    // Atualização de saldo em tempo real
    this.socket.on('ATUALIZACAO_SALDO', (data) => {
      console.log('💰 Saldo atualizado:', data);
      // Atualizar store/state da aplicação
      window.dispatchEvent(new CustomEvent('saldo-atualizado', { detail: data }));
    });

    // Novo lembrete do Kamba
    this.socket.on('NOVO_LEMBRETE', (data) => {
      console.log('🤖 Lembrete do Kamba:', data);
      window.dispatchEvent(new CustomEvent('novo-lembrete', { detail: data }));
    });

    // Alerta de gasto alto
    this.socket.on('ALERTA_GASTO_ALTO', (data) => {
      console.warn('⚠️ Alerta de gasto:', data);
      this.showAlert(data);
    });

    // Progresso de objetivo
    this.socket.on('PROGRESSO_OBJETIVO', (data) => {
      console.log('🎯 Progresso:', data);
      window.dispatchEvent(new CustomEvent('progresso-objetivo', { detail: data }));
    });

    // Desconexão
    this.socket.on('disconnect', (reason) => {
      console.log('🔴 WebSocket desconectado:', reason);
    });

    // Erros
    this.socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
      this.reconnectAttempts++;
    });
  }

  showNotification(data) {
    // Usar react-toastify ou similar
    if (window.showToast) {
      window.showToast(data.titulo, data.mensagem, data.tipo);
    }
  }

  showAlert(data) {
    if (window.showAlert) {
      window.showAlert(data.mensagem, 'warning');
    }
  }

  // Métodos públicos
  marcarNotificacaoLida(notificacaoId) {
    this.socket?.emit('notificacao_lida', { notificacaoId });
  }

  ping() {
    this.socket?.emit('ping');
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const socketClient = new SocketClient();
