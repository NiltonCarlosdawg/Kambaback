// src/services/newsService.ts
import api from './api';

export interface Artigo {
  titulo: string;
  descricao: string;
  fonte: string;
  url: string;
  imagem: string;
  publicadoEm: string;
}

export interface NewsResponse {
  success: boolean;
  data: {
    artigos: Artigo[];
    atualizadoEm?: string;
  };
}

export interface NewsSummaryResponse {
  success: boolean;
  data: {
    resumo: string;
    offline?: boolean;
    artigosUsados?: number;
  };
}

const newsService = {
  /**
   * Obtém notícias por categoria
   */
  async obterNoticias(categoria: string): Promise<NewsResponse> {
    const { data } = await api.get<NewsResponse>(`/noticias?categoria=${categoria}`);
    return data;
  },

  /**
   * Obtém o resumo das notícias via IA
   */
  async obterResumo(categoria: string): Promise<NewsSummaryResponse> {
    const { data } = await api.get<NewsSummaryResponse>(`/noticias/resumo?categoria=${categoria}`);
    return data;
  },
};

export default newsService;
