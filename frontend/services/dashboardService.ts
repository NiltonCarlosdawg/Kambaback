// src/services/dashboardService.ts
import api from './api';

export interface DashboardData {
  success?: boolean;
  saldos?: { total: number; disponivel: number; reservado: number };
  esteMes: {
    receitas: number;
    despesas: number;
    poupancaLiquida: number;
    taxaPoupanca?: number;
  };
  resumo?: {
    totalAlvo?: number;
    totalAtual?: number;
    progressoGeral?: number;
  };
  objetivos?: any[];
  fundoEmergencia?: {
    mesesCobertos: number;
    percentualAtingido: number;
  };
  alertas: Array<{
    tipo: 'perigo' | 'aviso' | 'info';
    titulo: string;
    mensagem: string;
    valor?: number;
  }>;
  cached?: boolean;
}

export interface HistoricoData {
  success?: boolean;
  historico?: {
    periodo: string;
    receitas: number;
    despesas: number;
    poupancaLiquida: number;
    taxaPoupanca: number;
  }[];
  resumo?: {
    totalReceitas: number;
    totalDespesas: number;
    totalPoupanca: number;
    taxaPoupancaMedia: number;
  };
}

const dashboardService = {
  /**
   * Obtém o resumo de insights do dashboard
   */
  async obterResumo(): Promise<DashboardData> {
    const { data } = await api.get<DashboardData>('/insights/resumo');
    return data;
  },

  /**
   * Obtém o resumo simplificado do dashboard (usado no Layout)
   */
  async obterResumoDashboard(): Promise<any> {
    const { data } = await api.get('/dashboard/resumo');
    return data;
  },

  /**
   * Obtém o histórico financeiro por período
   */
  async obterHistorico(periodo: string): Promise<HistoricoData> {
    const { data } = await api.get<HistoricoData>(`/insights/historico?periodo=${periodo}`);
    return data;
  },
  /**
   * Obtém as top categorias de gastos
   */
  async obterTopCategorias(): Promise<any> {
    const { data } = await api.get('/insights/top-categorias');
    return data;
  },
};

export default dashboardService;
