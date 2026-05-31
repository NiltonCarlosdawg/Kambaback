// src/services/kambaService.ts
import api from './api';

export interface KambaMessageResponse {
  success: boolean;
  mensagem: string;
  fluxoAtivo?: boolean;
  fluxoTipo?: string;
  fluxoConcluido?: boolean;
  fromCache?: boolean;
  rateLimited?: boolean;
  tentarEm?: number;
}

export interface KambaHistoryResponse {
  success: boolean;
  historico: Array<{
    role: 'user' | 'assistant';
    content: string;
    criadoEm?: string;
  }>;
}

const kambaService = {
  /**
   * Envia uma mensagem para o Kamba AI
   */
  async enviarMensagem(mensagem: string): Promise<KambaMessageResponse> {
    const { data } = await api.post<KambaMessageResponse>('/kamba', { mensagem });
    return data;
  },

  /**
   * Obtém o histórico de conversas do usuário
   */
  async obterHistorico(): Promise<KambaHistoryResponse> {
    const { data } = await api.get<KambaHistoryResponse>('/kamba/historico');
    return data;
  },
};

export default kambaService;
