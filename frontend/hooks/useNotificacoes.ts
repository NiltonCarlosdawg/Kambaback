// src/hooks/useNotificacoes.ts
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  Target, 
  ShieldAlert, 
  BarChart3, 
  Wallet, 
  Info,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  lida: boolean;
  criadoEm: string;
}

export interface NotificacaoTempoReal {
  id?: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  timestamp?: string;
  [key: string]: unknown;
}

export const useNotificacoes = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);
  const lastSyncRef = useRef(0);

  const buscarNaoLidas = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options;
    const now = Date.now();

    if (silent && now - lastSyncRef.current < 60 * 1000) {
      return;
    }

    try {
      if (!initializedRef.current) {
        setLoading(true);
      }

      const { data } = await api.get('/notificacoes/nao-lidas?limite=50');
      if (data.success) {
        setNotificacoes(data.notificacoes);
        setTotalNaoLidas(data.total);
      }
      lastSyncRef.current = now;
      initializedRef.current = true;
    } catch (err) {
      console.error('[NOTIFICACOES] Erro ao buscar:', err);
    } finally {
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
      setLoading(false);
    }
  }, []);

  const marcarComoLida = useCallback(async (id: string) => {
    try {
      await api.patch(`/notificacoes/${id}/lida`);
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
      setTotalNaoLidas(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[NOTIFICACOES] Erro ao marcar lida:', err);
    }
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    try {
      setLoading(true);
      await api.patch('/notificacoes/lidas/todas');
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setTotalNaoLidas(0);
    } catch (err) {
      console.error('[NOTIFICACOES] Erro ao marcar todas lidas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Adiciona notificação recebida em tempo real
  const adicionarTempoReal = useCallback((dados: NotificacaoTempoReal) => {
    const nova: Notificacao = {
      id: dados.id || `rt_${Date.now()}`,
      tipo: dados.tipo,
      titulo: dados.titulo || getTituloParaTipo(dados.tipo),
      corpo: dados.mensagem || '',
      lida: false,
      criadoEm: dados.timestamp || new Date().toISOString()
    };

    setNotificacoes(prev => [nova, ...prev].slice(0, 50));
    setTotalNaoLidas(prev => prev + 1);
  }, []);

  // Busca inicial
  useEffect(() => {
    buscarNaoLidas();
  }, [buscarNaoLidas]);

  // Sincronização discreta quando a aba volta ao foco
  useEffect(() => {
    const syncSilencioso = () => {
      if (document.visibilityState === 'visible') {
        buscarNaoLidas({ silent: true });
      }
    };

    window.addEventListener('focus', syncSilencioso);
    document.addEventListener('visibilitychange', syncSilencioso);

    return () => {
      window.removeEventListener('focus', syncSilencioso);
      document.removeEventListener('visibilitychange', syncSilencioso);
    };
  }, [buscarNaoLidas]);

  return {
    notificacoes,
    totalNaoLidas,
    loading,
    buscarNaoLidas,
    marcarComoLida,
    marcarTodasLidas,
    adicionarTempoReal
  };
};

// Helpers
const getTituloParaTipo = (tipo: string): string => {
  const map: Record<string, string> = {
    'NOVO_LEMBRETE': 'Lembrete',
    'LEMBRETE_GASTO_ALTO': 'Gasto Elevado',
    'LEMBRETE_OBJETIVO_PERTO': 'Meta Próxima',
    'LEMBRETE_FUNDO_BAIXO': 'Fundo Baixo',
    'LEMBRETE_BALANCO_SEMANAL': 'Balanço Semanal',
    'ALERTA_GASTO_ALTO': 'Alerta de Gasto',
    'PROGRESSO_OBJETIVO': 'Progresso da Meta',
    'ATUALIZACAO_SALDO': 'Saldo Atualizado',
    'NOTIFICACAO_SISTEMA': 'Sistema',
  };
  return map[tipo] || 'Notificação';
};

export const getIconeParaTipo = (tipo: string): React.ReactNode => {
  switch (tipo) {
    case 'LEMBRETE_GASTO_ALTO':
    case 'ALERTA_GASTO_ALTO':
      return React.createElement(AlertTriangle, { size: 16 });
    case 'LEMBRETE_OBJETIVO_PERTO':
      return React.createElement(Clock, { size: 16 });
    case 'PROGRESSO_OBJETIVO':
      return React.createElement(Target, { size: 16 });
    case 'LEMBRETE_FUNDO_BAIXO':
      return React.createElement(ShieldAlert, { size: 16 });
    case 'LEMBRETE_BALANCO_SEMANAL':
      return React.createElement(BarChart3, { size: 16 });
    case 'ATUALIZACAO_SALDO':
      return React.createElement(Wallet, { size: 16 });
    case 'NOTIFICACAO_SISTEMA':
      return React.createElement(Info, { size: 16 });
    case 'CONCLUIDO':
      return React.createElement(CheckCircle2, { size: 16 });
    default:
      return React.createElement(Bell, { size: 16 });
  }
};

export const getCorParaTipo = (tipo: string): string => {
  if (tipo.includes('GASTO') || tipo.includes('ALERTA')) return 'text-red-400';
  if (tipo.includes('OBJETIVO') || tipo.includes('META')) return 'text-blue-400';
  if (tipo.includes('SALDO')) return 'text-green-400';
  if (tipo.includes('FUNDO')) return 'text-orange-400';
  return 'text-[#cbfb46]';
};

export const tempoRelativo = (isoString: string): string => {
  const agora = new Date();
  const data = new Date(isoString);
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `${diffMin}m atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD === 1) return 'Ontem';
  return data.toLocaleDateString('pt-AO', { day: 'numeric', month: 'short' });
};

export default useNotificacoes;
