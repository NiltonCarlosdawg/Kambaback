// src/services/goalsService.ts
import api from './api';
import { Objetivo } from '../types';

export interface GoalsResponse {
  success: boolean;
  objetivos?: Objetivo[];
  concluidos?: Objetivo[];
  resumo?: any;
}

const goalsService = {
  /**
   * Lista os objetivos financeiros
   */
  async listar(): Promise<GoalsResponse> {
    const { data } = await api.get<GoalsResponse>('/objetivos');
    return data;
  },

  /**
   * Cria um novo objetivo
   */
  async criar(payload: any): Promise<any> {
    const { data } = await api.post('/objetivos', payload);
    return data;
  },

  /**
   * Atualiza um objetivo existente
   */
  async atualizar(id: string, payload: any): Promise<any> {
    const { data } = await api.put(`/objetivos/${id}`, payload);
    return data;
  },

  /**
   * Remove um objetivo
   */
  async remover(id: string): Promise<any> {
    const { data } = await api.delete(`/objetivos/${id}`);
    return data;
  },
};

export default goalsService;
