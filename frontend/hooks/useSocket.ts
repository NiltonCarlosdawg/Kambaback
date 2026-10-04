// src/hooks/useSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../services/api';

type EventHandler = (data: unknown) => void;

interface UseSocketOptions {
  onNotificacao?: EventHandler;
  onLembrete?: EventHandler;
  onAlertaGasto?: EventHandler;
  onProgressoObjetivo?: EventHandler;
  onAtualizacaoSaldo?: EventHandler;
  onNotificacaoSistema?: EventHandler;
  onConectado?: () => void;
  onDesconectado?: (reason: string) => void;
}

let globalSocket: Socket | null = null;

const getSocket = (): Socket | null => globalSocket;

const createSocket = (token: string): Socket => {
  if (globalSocket?.connected) return globalSocket;

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

  globalSocket = io(baseURL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  return globalSocket;
};

export const useSocket = (options: UseSocketOptions = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const token = getAccessToken(); // F-019: access token só em memória
    if (!token) return;

    const socket = createSocket(token);
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('[SOCKET] Conectado:', socket.id);
      optionsRef.current.onConectado?.();
    };

    const handleDisconnect = (reason: string) => {
      console.log('[SOCKET] Desconectado:', reason);
      optionsRef.current.onDesconectado?.(reason);
    };

    const handleNotificacao = (data: unknown) => {
      const payload = data as { tipo: string; dados: unknown };
      
      switch (payload.tipo) {
        case 'NOVO_LEMBRETE':
          optionsRef.current.onLembrete?.(payload.dados);
          break;
        case 'ALERTA_GASTO_ALTO':
          optionsRef.current.onAlertaGasto?.(payload.dados);
          break;
        case 'PROGRESSO_OBJETIVO':
          optionsRef.current.onProgressoObjetivo?.(payload.dados);
          break;
        case 'ATUALIZACAO_SALDO':
          optionsRef.current.onAtualizacaoSaldo?.(payload.dados);
          break;
        case 'NOTIFICACAO_SISTEMA':
          optionsRef.current.onNotificacaoSistema?.(payload.dados);
          break;
        default:
          optionsRef.current.onNotificacao?.(payload);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notificacao', handleNotificacao);
    socket.on('notificacao_broadcast', handleNotificacao);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notificacao', handleNotificacao);
      socket.off('notificacao_broadcast', handleNotificacao);
    };
  }, []);

  const marcarLido = useCallback((notificacaoId: string) => {
    socketRef.current?.emit('notificacao_lida', { notificacaoId });
  }, []);

  const isConectado = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { marcarLido, isConectado, getSocket };
};

export default useSocket;
