// src/services/authService.ts
import api from './api';

export interface PerfilData {
  id?: string;
  nome: string;
  email: string;
  telefone?: string;
  morada?: string;
  sexo?: string;
  dataNascimento?: string;
  rendaMensalMedia?: number;
  perfilDeRisco?: string;
  role?: string;
  verificado?: boolean;
  criadoEm?: string;
  ultimoLogin?: string;
}

export interface PerfilResponse {
  success: boolean;
  usuario: PerfilData;
}

const authService = {
  /**
   * Obtém o perfil do usuário logado
   */
  async obterPerfil(): Promise<PerfilResponse> {
    const { data } = await api.get<PerfilResponse>('/auth/perfil');
    return data;
  },

  /**
   * Atualiza o perfil do usuário
   */
  async atualizarPerfil(payload: Partial<PerfilData>): Promise<PerfilResponse> {
    const { data } = await api.patch<PerfilResponse>('/auth/perfil', payload);
    return data;
  },

  /**
   * Altera a senha do usuário
   */
  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<any> {
    const { data } = await api.post('/auth/alterar-senha', { senhaAtual, novaSenha });
    return data;
  },
};

export default authService;
