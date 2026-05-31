// src/services/fundoEmergenciaService.ts
import api from './api';

export interface FundoStatus {
  existe: boolean;
  ativo: boolean;
  fundo?: {
    id: string;
    nome: string;
    saldoAtual: number;
    saldoDisponivel: number;
  };
  metricas?: {
    despesaMediaMensal: number;
    alvoEmergencia: number;
    mesesCobertos: number;
    percentualAtingido: number;
    mesesRecomendados: number;
  };
  depositoMinimoAtivacao: number;
}

const fundoEmergenciaService = {
  /**
   * Obtém o status do fundo de emergência
   */
  async obterStatus(): Promise<FundoStatus> {
    const { data } = await api.get<FundoStatus>('/fundo-emergencia');
    return data;
  },

  /**
   * Inicializa o fundo de emergência
   */
  async inicializar(): Promise<any> {
    const { data } = await api.post('/fundo-emergencia');
    return data;
  },

  /**
   * Realiza um depósito no fundo de emergência
   */
  async depositar(cartaoOrigemId: string, valor: number): Promise<any> {
    const { data } = await api.post('/fundo-emergencia/depositar', { cartaoOrigemId, valor });
    return data;
  },
};

export default fundoEmergenciaService;
