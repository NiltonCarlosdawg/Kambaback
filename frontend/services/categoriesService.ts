// src/services/categoriesService.ts
import api from './api';

export interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  icone?: string;
  padrao: boolean;
  ordem?: number;
  ativa?: boolean;
}

export interface CategoriesResponse {
  success: boolean;
  categorias: Categoria[];
}

const categoriesService = {
  /**
   * Lista todas as categorias
   */
  async listar(): Promise<CategoriesResponse> {
    const { data } = await api.get<CategoriesResponse>('/categorias');
    return data;
  },

  /**
   * Cria uma nova categoria
   */
  async criar(payload: any): Promise<any> {
    const { data } = await api.post('/categorias', payload);
    return data;
  },

  /**
   * Atualiza uma categoria existente
   */
  async atualizar(id: string, payload: any): Promise<any> {
    const { data } = await api.patch(`/categorias/${id}`, payload);
    return data;
  },

  /**
   * Remove uma categoria
   */
  async remover(id: string): Promise<any> {
    const { data } = await api.delete(`/categorias/${id}`);
    return data;
  },
};

export default categoriesService;
