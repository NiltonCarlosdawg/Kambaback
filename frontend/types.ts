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
  message?: string;
  user?: User;
  usuario?: User;
  accessToken: string;
  refreshToken?: string;
}

export interface Cartao {
  id: string;
  nome: string;
  // Runtime do backend: enum TipoCartao — validado em /cartoes como
  // ['DEBITO','CREDITO','POUPANCA'].
  tipo: 'DEBITO' | 'CREDITO' | 'POUPANCA';
  banco?: string;
  numero?: string;
  saldoAtual: number;
  limiteCredito?: number;
  disponivel?: number;
  saldoDisponivel?: number;
  cor?: string;
  icone?: string;
  ativo: boolean;
  bloqueado: boolean;
  excluido?: boolean;
  distribuirParaObjetivos?: boolean;
  percentualDistribuicaoPoupanca?: number;
}

export interface Categoria {
  id: string;
  nome: string;
  // Runtime do backend: enum TipoCategoria (schema.prisma) — validado em
  // /categorias como ['ESSENCIAL','FLEXIVEL','POUPANCA','RENDIMENTO'].
  tipo: 'ESSENCIAL' | 'FLEXIVEL' | 'POUPANCA' | 'RENDIMENTO';
  cor?: string;
  icone?: string;
  padrao: boolean;
  ativa?: boolean;
}

export interface Gasto {
  id: string;
  descricao?: string;
  valor: number;
  // Runtime do backend: enum TipoGasto — validado em /gastos como
  // ['DESPESA','RECEITA'] (o valor minúsculo nunca chegava a bater certo).
  tipo: 'DESPESA' | 'RECEITA';
  data: string;
  local?: string;
  categoria: Categoria | null; // Pode ser null se categoria foi deletada
  cartao: Cartao | null; // Pode ser null se cartão foi deletado
  objetivo?: {
    id: string;
    titulo: string;
  } | null;
  distribuicaoAutomatica?: boolean;
  distribuicoes?: Array<{
    objetivoId: string;
    titulo: string;
    porcentagem?: number;
    valor?: number;
    tipo?: string;
  }>;
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
  dataPrevista?: string;
  cor?: string;
  icone?: string;
  concluido: boolean;
  prioridade?: string;
  porcentagemDistribuicao?: number;
  modoDistribuicao?: 'automatico' | 'manual';
  categoria?: string;
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
