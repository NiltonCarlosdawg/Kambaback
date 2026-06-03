// src/services/transactionsService.ts
import api from './api';
import { Gasto } from '../types';

export interface GastosResponse {
  success: boolean;
  gastos?: Gasto[];
  transacoes?: Gasto[];
}

export interface CriarGastoPayload {
  descricao: string;
  valor: number;
  tipo: 'DESPESA' | 'RECEITA';
  data: string;
  cartaoId: string;
  categoriaId: string;
  objetivoId?: string | null;
  local?: string;
  parcelado?: boolean;
  totalParcelas?: number;
  parcelaAtual?: number;
  tags?: string[];
}

const transactionsService = {
  /**
   * Obtém a lista de gastos/transações
   */
  async listar(limite?: number): Promise<GastosResponse> {
    const url = limite ? `/gastos?limite=${limite}` : '/gastos';
    const { data } = await api.get<GastosResponse>(url);
    return data;
  },

  /**
   * Registra uma nova transação
   */
  async criar(payload: CriarGastoPayload): Promise<any> {
    const { data } = await api.post('/gastos', payload);
    return data;
  },

  /**
   * Remove uma transação
   */
  async remover(id: string): Promise<any> {
    const { data } = await api.delete(`/gastos/${id}`);
    return data;
  },
};

export default transactionsService;
