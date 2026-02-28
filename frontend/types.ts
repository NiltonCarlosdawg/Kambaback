// Tipos sincronizados com o backend (schema.prisma)

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  morada?: string;
  sexo?: string;
  rendaMensalMedia?: number;
  role: 'user' | 'admin'; // Agora existe no schema!
  ativo: boolean;
  bloqueado: boolean;
  verificado: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface Cartao {
  id: string;
  nome: string;
  tipo: 'multicaixa' | 'conta_bancaria' | 'ekwanza' | 'credito' | 'debito' | 'investimento';
  banco?: string;
  numero?: string;
  saldoAtual: number;
  limiteCredito?: number;
  disponivel?: number;
  cor?: string;
  icone?: string;
  ativo: boolean;
  bloqueado: boolean;
  excluido?: boolean; // Soft delete flag (não mostrar se true)
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  cor?: string;
  icone?: string;
  padrao: boolean;
  ativa?: boolean;
}

export interface Gasto {
  id: string;
  descricao?: string;
  valor: number;
  tipo: 'despesa' | 'receita';
  data: string;
  local?: string;
  categoria: Categoria | null; // Pode ser null se categoria foi deletada
  cartao: Cartao | null; // Pode ser null se cartão foi deletado
  excluido?: boolean;
}

export interface Objetivo {
  id: string;
  titulo: string;
  descricao?: string;
  valorAlvo: number;
  valorAtual: number;
  progressoPercentual: number;
  valorFaltante: number;
  dataFinal: string;
  dataPrevista?: string; // Alias opcional
  cor?: string;
  icone?: string;
  concluido: boolean;
  prioridade?: string;
  porcentagemDistribuicao?: number;
  modoDistribuicao?: 'automatico' | 'manual';
}

export interface KambaMessage {
  sender: 'user' | 'kamba';
  text: string;
  timestamp: string;
  fluxoAtivo?: boolean;
  fluxoConcluido?: boolean;
}

export interface DashboardData {
  saldoTotal: number;
  esteMes: {
    receitas: number;
    despesas: number;
    poupancaLiquida: number;
  };
  alertas: Array<{
    tipo: string;
    titulo: string;
    mensagem: string;
  }>;
  resumoCartoes?: {
    totalCartoes: number;
    saldoTotal: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    mensagemAmigavel?: string;
    details?: any[];
  };
}