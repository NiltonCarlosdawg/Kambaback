const { gerarEmbedding } = require("../../services/ai/embeddingService");

const EXEMPLOS = [
  // ── dados_financeiros ──────────────────────────────────
  { intencao: "dados_financeiros", texto: "qual é o meu saldo" },
  { intencao: "dados_financeiros", texto: "quanto dinheiro tenho na conta" },
  { intencao: "dados_financeiros", texto: "quanto gastei este mês" },
  { intencao: "dados_financeiros", texto: "mostra meus gastos do mês" },
  { intencao: "dados_financeiros", texto: "quero ver minhas despesas" },
  { intencao: "dados_financeiros", texto: "meus gastos por categoria" },
  { intencao: "dados_financeiros", texto: "compara com o mês passado" },
  {
    intencao: "dados_financeiros",
    texto: "como vão meus objetivos financeiros",
  },
  { intencao: "dados_financeiros", texto: "progresso das minhas metas" },
  { intencao: "dados_financeiros", texto: "situação do fundo de emergência" },
  {
    intencao: "dados_financeiros",
    texto: "quanto tenho no fundo de emergência",
  },
  { intencao: "dados_financeiros", texto: "resumo financeiro deste mês" },
  { intencao: "dados_financeiros", texto: "análise dos meus gastos" },
  { intencao: "dados_financeiros", texto: "mostra o saldo dos meus cartões" },
  {
    intencao: "dados_financeiros",
    texto: "como está a minha situação financeira",
  },
  { intencao: "dados_financeiros", texto: "quanto recebi este mês" },
  { intencao: "dados_financeiros", texto: "quanto poupei este mês" },
  { intencao: "dados_financeiros", texto: "fluxo de caixa do mês" },
  { intencao: "dados_financeiros", texto: "quanto tenho disponível" },
  { intencao: "dados_financeiros", texto: "o que tenho na conta" },
  { intencao: "dados_financeiros", texto: "dinheiro disponível" },
  { intencao: "dados_financeiros", texto: "ver o meu dinheiro" },
  { intencao: "dados_financeiros", texto: "quanto dinheiro tenho guardado" },

  // ── cotacao ─────────────────────────────────────────────
  { intencao: "cotacao", texto: "preço do dólar hoje" },
  { intencao: "cotacao", texto: "cotação do dólar em Angola" },
  { intencao: "cotacao", texto: "quanto está o dólar" },
  { intencao: "cotacao", texto: "taxa de câmbio do euro" },
  { intencao: "cotacao", texto: "dólar paralelo hoje" },
  { intencao: "cotacao", texto: "euro para kwanza" },
  { intencao: "cotacao", texto: "usd para aoa" },
  { intencao: "cotacao", texto: "quanto vale o dólar" },
  { intencao: "cotacao", texto: "câmbio actual" },
  { intencao: "cotacao", texto: "valor do dólar em kwanza" },

  // ── negocio ─────────────────────────────────────────────
  { intencao: "negocio", texto: "ideias de negócio em Angola" },
  { intencao: "negocio", texto: "quero começar um negócio" },
  { intencao: "negocio", texto: "negócio com 50 mil kwanzas" },
  { intencao: "negocio", texto: "que negócio posso abrir" },
  { intencao: "negocio", texto: "quero empreender em Luanda" },
  { intencao: "negocio", texto: "ideias para ganhar dinheiro" },
  { intencao: "negocio", texto: "como posso ganhar dinheiro" },
  { intencao: "negocio", texto: "quero ter o meu negócio" },

  // ── poupanca ───────────────────────────────────────────
  { intencao: "poupanca", texto: "dicas para poupar dinheiro" },
  { intencao: "poupanca", texto: "como economizar em Luanda" },
  { intencao: "poupanca", texto: "como poupar com salário baixo" },
  { intencao: "poupanca", texto: "regra 50 30 20 para poupar" },
  { intencao: "poupanca", texto: "dicas de economia doméstica" },
  { intencao: "poupanca", texto: "como guardar dinheiro todo mês" },
  { intencao: "poupanca", texto: "como guardo dinheiro" },
  { intencao: "poupanca", texto: "não consigo poupar" },
  { intencao: "poupanca", texto: "dicas para gastar menos" },

  // ── investimento ───────────────────────────────────────
  { intencao: "investimento", texto: "onde investir em Angola" },
  { intencao: "investimento", texto: "investir em dólar" },
  { intencao: "investimento", texto: "certificados do tesouro" },
  { intencao: "investimento", texto: "depósito a prazo" },
  { intencao: "investimento", texto: "como investir meu dinheiro" },
  { intencao: "investimento", texto: "melhores investimentos em Angola" },

  // ── planeamento ────────────────────────────────────────
  { intencao: "planeamento", texto: "planeamento orçamental mensal" },
  { intencao: "planeamento", texto: "cria um orçamento para mim" },
  { intencao: "planeamento", texto: "quanto posso gastar este mês" },
  { intencao: "planeamento", texto: "organizar minhas finanças" },

  // ── ajuda ──────────────────────────────────────────────
  { intencao: "ajuda", texto: "o que podes fazer" },
  { intencao: "ajuda", texto: "comandos disponíveis" },
  { intencao: "ajuda", texto: "como funciona o kamba" },
  { intencao: "ajuda", texto: "lista de comandos" },
  { intencao: "ajuda", texto: "preciso de ajuda" },

  // ── educacao ───────────────────────────────────────────
  { intencao: "educacao", texto: "o que é inflação" },
  { intencao: "educacao", texto: "explica juros compostos" },
  { intencao: "educacao", texto: "o que significa poupança" },
  { intencao: "educacao", texto: "diferença entre débito e crédito" },
  { intencao: "educacao", texto: "como funciona o mercado paralelo" },
  { intencao: "educacao", texto: "o que é fundo de emergência" },

  // ── casual ─────────────────────────────────────────────
  { intencao: "casual", texto: "olá kamba tudo bem" },
  { intencao: "casual", texto: "bom dia tudo bem" },
  { intencao: "casual", texto: "obrigado pela ajuda" },
  { intencao: "casual", texto: "valeu mano" },
  { intencao: "casual", texto: "ok obrigado" },
  { intencao: "casual", texto: "parabéns pelo trabalho" },
  { intencao: "casual", texto: "até logo" },
];

const EXEMPLOS_COM_EMBEDDING = EXEMPLOS.map((ex) => ({
  ...ex,
  embedding: gerarEmbedding(ex.texto),
}));

const INTENCOES_PRECISA_TOOLS = new Set([
  "dados_financeiros",
  "cotacao",
  "negocio",
  "planeamento",
]);

const buscarPorSimilaridade = (mensagem) => {
  const msgEmbedding = gerarEmbedding(mensagem);
  const {
    calcularSimilaridade,
  } = require("../../services/ai/embeddingService");

  let melhor = { intencao: "desconhecido", confianca: 0, idx: -1 };

  for (let i = 0; i < EXEMPLOS_COM_EMBEDDING.length; i++) {
    const ex = EXEMPLOS_COM_EMBEDDING[i];
    const sim = calcularSimilaridade(msgEmbedding, ex.embedding);
    if (sim > melhor.confianca) {
      melhor = { intencao: ex.intencao, confianca: sim, idx: i };
    }
  }

  return {
    intencao: melhor.intencao,
    confianca: Math.round(melhor.confianca * 100) / 100,
    precisaTools: INTENCOES_PRECISA_TOOLS.has(melhor.intencao),
    exemploCorrespondente: EXEMPLOS[melhor.idx]?.texto || "",
  };
};

module.exports = {
  EXEMPLOS,
  EXEMPLOS_COM_EMBEDDING,
  buscarPorSimilaridade,
  INTENCOES_PRECISA_TOOLS,
};
