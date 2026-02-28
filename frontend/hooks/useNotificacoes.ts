// src/hooks/useNotificacoes.ts
import { useState, useCallback, useEffect } from 'react';
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

  const buscarNaoLidas = useCallback(async () => {
    try {
      const { data } = await api.get('/notificacoes/nao-lidas?limite=50');
      if (data.success) {
        setNotificacoes(data.notificacoes);
        setTotalNaoLidas(data.total);
      }
    } catch (err) {
      console.error('[NOTIFICACOES] Erro ao buscar:', err);
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
    // Refresh a cada 5 minutos como fallback
    const interval = setInterval(buscarNaoLidas, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
    'NOVO_LEMBRETE': '🔔 Lembrete',
    'LEMBRETE_GASTO_ALTO': '⚠️ Gasto Elevado',
    'LEMBRETE_OBJETIVO_PERTO': '⏰ Meta Próxima',
    'LEMBRETE_FUNDO_BAIXO': '🛡️ Fundo Baixo',
    'LEMBRETE_BALANCO_SEMANAL': '📊 Balanço Semanal',
    'ALERTA_GASTO_ALTO': '⚠️ Alerta de Gasto',
    'PROGRESSO_OBJETIVO': '🎯 Progresso da Meta',
    'ATUALIZACAO_SALDO': '💰 Saldo Atualizado',
    'NOTIFICACAO_SISTEMA': 'ℹ️ Sistema',
  };
  return map[tipo] || '🔔 Notificação';
};

export const getIconeParaTipo = (tipo: string): string => {
  const map: Record<string, string> = {
    'LEMBRETE_GASTO_ALTO': '⚠️',
    'ALERTA_GASTO_ALTO': '⚠️',
    'LEMBRETE_OBJETIVO_PERTO': '⏰',
    'PROGRESSO_OBJETIVO': '🎯',
    'LEMBRETE_FUNDO_BAIXO': '🛡️',
    'LEMBRETE_BALANCO_SEMANAL': '📊',
    'ATUALIZACAO_SALDO': '💰',
    'NOTIFICACAO_SISTEMA': 'ℹ️',
  };
  return map[tipo] || '🔔';
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