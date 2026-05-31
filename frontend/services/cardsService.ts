// src/services/cardsService.ts
import api from './api';
import { Cartao } from '../types';

export interface CartoesResponse {
  success: boolean;
  cartoes: Cartao[];
}

const cardsService = {
  /**
   * Lista todos os cartões do usuário
   */
  async listar(): Promise<CartoesResponse> {
    const { data } = await api.get<CartoesResponse>('/cartoes');
    return data;
  },

  /**
   * Cria um novo cartão
   */
  async criar(payload: any): Promise<any> {
    const { data } = await api.post('/cartoes', payload);
    return data;
  },

  /**
   * Atualiza as configurações de um cartão
   */
  async atualizar(id: string, payload: any): Promise<any> {
    const { data } = await api.patch(`/cartoes/${id}`, payload);
    return data;
  },

  /**
   * Remove um cartão
   */
  async remover(id: string): Promise<any> {
    const { data } = await api.delete(`/cartoes/${id}`);
    return data;
  },
};

export default cardsService;
