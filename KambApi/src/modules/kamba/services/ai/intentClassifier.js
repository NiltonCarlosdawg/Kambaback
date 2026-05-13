const { buscarPorSimilaridade } = require('../../plugins/intents/intentDataset');

const CONFIANCA_REGEX_EXATO = 0.95;
const CONFIANCA_REGEX_ALTA = 0.90;
const CONFIANCA_CONTEXTO = 0.85;
const CONFIANCA_NIVEL_2 = 0.60;
const CONFIANCA_MINIMA_NIVEL2 = 0.35;
const CONFIANCA_FALLBACK = 0.30;

const classificarIntencao = (msgLower, historicoRecente = []) => {
  // ── NÍVEL 1: REGEX (Rápido) ─────────────────────────────
  const regexResult = classificarPorRegex(msgLower, historicoRecente);
  if (regexResult && regexResult.confianca >= CONFIANCA_REGEX_ALTA) {
    return { ...regexResult, nivel: 1 };
  }

  // ── NÍVEL 2: EMBEDDINGS + SIMILARIDADE ──────────────────
  const similaridade = buscarPorSimilaridade(msgLower);
  if (similaridade.confianca >= CONFIANCA_MINIMA_NIVEL2) {
    return {
      precisaTools: similaridade.precisaTools,
      intencao: similaridade.intencao,
      confianca: Math.max(similaridade.confianca, CONFIANCA_NIVEL_2),
      nivel: 2
    };
  }

  // ── NÍVEL 3: ENTIDADES (fallback intermédio) ────────────
  const entidades = extrairEntidades(msgLower);
  if (entidades.valorMonetario && entidades.temaNegocio) {
    return { precisaTools: true, intencao: 'negocio', confianca: 0.75, nivel: 3 };
  }
  if (entidades.temaDolar && entidades.valorNumerico) {
    return { precisaTools: true, intencao: 'cotacao', confianca: 0.70, nivel: 3 };
  }

  // ── Desconhecido ────────────────────────────────────────
  return { precisaTools: false, intencao: 'desconhecido', confianca: CONFIANCA_FALLBACK, nivel: 0 };
};

const classificarPorRegex = (msgLower, historicoRecente) => {
  // ── BLACKLIST: nunca precisam de tools ──────────────────
  const NUNCA_TOOLS = [
    /^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|komé|kome|salve|e aí|tudo bem)\b/,
    /^(obrigad[ao]|valeu|fixe|ok|certo|entend[oi]|perceb[oi]|sim\s*(?:,.*)?$|não\s*(?:,.*)?$)/,
    /^(ajuda|help|cancelar|sair|fluxos)$/,
    /^(bom|boa|fixe|massa|parabéns|top|incrível|amazing)\b/,
    /(o que (achas|recomendas)|vale a pena|devo (comprar|vender))/,
    /(notícia|economia|petróleo|inflação|mercado|crise|exporta)/,
    /(o que é|explica|como funciona|diferença entre|o que significa)/,
  ];

  if (NUNCA_TOOLS.some(re => re.test(msgLower))) {
    return { precisaTools: false, intencao: 'casual', confianca: CONFIANCA_REGEX_EXATO };
  }

  // ── WHITELIST: ferramentas específicas ──────────────────
  if (/\b(preço|cotacao|cotação|taxa|câmbio|cambio)\b.*\b(dolar|dólar|euro|usd|eur)\b|\b(dolar|dólar)\b.*\b(hoje|agora|actual|atual)\b/.test(msgLower)) {
    return { precisaTools: true, intencao: 'cotacao', confianca: CONFIANCA_REGEX_ALTA };
  }

  if (/\b(negocio|negócio|empreender|começar um negócio|ideias? de negócio)\b|\b(tenho|com) \d+.*\b(kwanzas|aoa)\b.*\b(negocio|negócio|começar)\b/.test(msgLower)) {
    return { precisaTools: true, intencao: 'negocio', confianca: CONFIANCA_REGEX_ALTA };
  }

  if (/\b(planeamento|orçamento|orcamento|organizar finanças|quanto posso gastar)\b/.test(msgLower)) {
    return { precisaTools: true, intencao: 'planeamento', confianca: CONFIANCA_REGEX_ALTA };
  }

  if (/\b(poupar|economizar|juntar dinheiro|guardar dinheiro|dicas de poupança|como poupar)\b/.test(msgLower)) {
    return { precisaTools: false, intencao: 'poupanca', confianca: CONFIANCA_REGEX_ALTA };
  }

  if (/\binvestir\b|\binvestimento\b|\bonde investir\b|\bjuros compostos\b/.test(msgLower)) {
    return { precisaTools: false, intencao: 'investimento', confianca: CONFIANCA_REGEX_ALTA };
  }

  if (/\b(o que é|explica|como funciona|diferença entre|o que significa)\b|\beducação financeira\b/.test(msgLower)) {
    return { precisaTools: false, intencao: 'educacao', confianca: CONFIANCA_REGEX_ALTA };
  }

  // ── PEDIDO DIRECTO DE DADOS FINANCEIROS ─────────────────
  const PEDE_DADOS = [
    /\b(qual|quanto|ver|mostrar|analisar|análise)\b.*\b(saldo|gasto|despesa|receita|objetivo|meta|fundo|cartão|conta)/,
    /\b(saldo|gastos do mês|despesas do mês|fluxo de caixa)\b/,
    /\b(meus gastos|meus objetivos|minhas metas|meu saldo|minha conta)\b/,
    /\b(fundo de emergência|fundo emergencia)\b/,
    /\b(gastos por categoria|comparar com o mês|mês passado)\b/,
    /^(quanto (tenho|gastei|recebi|poupei))/,
    /\b(objetivos?|metas?)\b.*\b(perto|próximo|conclu|progresso|atingi|falt)/,
    /\b(como (vão|está|estão)).*\b(objetivos?|metas?|gastos?|saldo|contas?)\b/,
    /\b(progresso|percentagem|percentual|quanto falta).*\b(meta|objetivo)\b/,
    /\b(análise|analisar|resumo|como (vou|estou|ando)).*\b(mês|financ|dinheiro|kumbú)\b/,
    /\b(como (vou|estou|ando)) (financeiramente|este mês|neste mês|no mês)\b/,
    /\b(fluxo de caixa|análise de gastos|análise preditiva)\b/,
  ];

  if (PEDE_DADOS.some(re => re.test(msgLower))) {
    return { precisaTools: true, intencao: 'dados_financeiros', confianca: CONFIANCA_REGEX_ALTA };
  }

  // ── CONTEXTO: resposta afirmativa após proposta ─────────
  const RESPOSTAS_AFIRMATIVAS = /^(sim|claro|bora|pode|quero|vai|yha|exacto|isso|ok sim|s$)/;
  if (RESPOSTAS_AFIRMATIVAS.test(msgLower)) {
    const ultimaResp = [...historicoRecente].reverse().find(m => m.role === 'assistant')?.content?.toLowerCase() || '';
    const PROPOSTA_DADOS = [
      /quer(es)? (que eu )?(mostrar|ver|verificar|analisar|buscar)/,
      /posso (mostrar|ver|verificar|analisar|buscar)/,
      /quer(es)? ver (o (teu|tua)|os teus|as tuas)/,
    ];
    if (PROPOSTA_DADOS.some(re => re.test(ultimaResp))) {
      return { precisaTools: true, intencao: 'confirmacao_dados', confianca: CONFIANCA_CONTEXTO };
    }
  }

  return null;
};

const extrairEntidades = (msgLower) => {
  const valorMonetarioMatch = msgLower.match(/(\d[\d\s.]{1,15}?\d*)\s*(kwanzas?|aoa|kz|reais?|mil|milhão|milhões|bilião|bilhão)\b/i);
  const valorMonetario = valorMonetarioMatch ? {
    valor: parseFloat(valorMonetarioMatch[1].replace(/[\s.]/g, '').replace(',', '.')),
    moeda: valorMonetarioMatch[2].toLowerCase()
  } : null;

  const numeros = msgLower.match(/\b\d{3,15}\b/g);

  return {
    valorMonetario,
    valoresNumericos: numeros ? numeros.map(Number) : [],
    temaNegocio: /\b(negocio|negócio|empreender|vender|cliente|loja|revenda)\b/.test(msgLower),
    temaDolar: /\b(dolar|dólar|usd|cambio|câmbio|paralelo|oficial)\b/.test(msgLower),
    temaPoupanca: /\b(poupar|economizar|guardar|juntar|poupança|economia)\b/.test(msgLower),
    temaInvestimento: /\b(investir|investimento|juros|rendimento|rentabilidade|tesouro|acções|accoes)\b/.test(msgLower),
    temaObjetivo: /\b(objetivo|meta|atingir|alcançar|concluir|concluído)\b/.test(msgLower),
    data: (() => {
      if (/\b(hoje|agora)\b/.test(msgLower)) return 'hoje';
      if (/\b(ontem)\b/.test(msgLower)) return 'ontem';
      if (/\b(amanhã)\b/.test(msgLower)) return 'amanha';
      if (/\b(esta semana|essa semana)\b/.test(msgLower)) return 'esta_semana';
      if (/\b(este mês|esse mês|nesse mês|no mês)\b/.test(msgLower)) return 'este_mes';
      if (/\b(mês passado|mês anterior)\b/.test(msgLower)) return 'mes_passado';
      if (/\b(este ano|nesse ano)\b/.test(msgLower)) return 'este_ano';
      return null;
    })(),
    categoriaGasto: (() => {
      const cats = [
        { nome: 'Alimentação', padrao: /\b(alimentação|comida|supermercado|restaurante|mercearia|feira|compras? do mês)\b/ },
        { nome: 'Transporte', padrao: /\b(transporte|candongueiro|kupapata|gasolina|combustível|viagem|passagem|boleia)\b/ },
        { nome: 'Lazer', padrao: /\b(lazer|cinema|festa|saída|passeio|diversão|entretenimento)\b/ },
        { nome: 'Saúde', padrao: /\b(saúde|hospital|farmácia|médico|consulta|remédio|medicamento|plano de saúde)\b/ },
        { nome: 'Educação', padrao: /\b(educação|escola|faculdade|curso|propina|material escolar)\b/ },
        { nome: 'Casa', padrao: /\b(casa|renda|condomínio|luz|água|eletricidade|ende|epal|manutenção)\b/ },
      ];
      for (const cat of cats) {
        if (cat.padrao.test(msgLower)) return cat.nome;
      }
      return null;
    })(),
    banco: (() => {
      const bancos = [
        { nome: 'BAI', padrao: /\bbai\b/ },
        { nome: 'BFA', padrao: /\bbfa\b/ },
        { nome: 'BIC', padrao: /\bbic\b/ },
        { nome: 'Banco Sol', padrao: /\b(sol|banco sol)\b/ },
        { nome: 'Atlântico', padrao: /\batlântico\b/ },
      ];
      for (const b of bancos) {
        if (b.padrao.test(msgLower)) return b.nome;
      }
      return null;
    })(),
    temNegocioFormal: /\b(contrato|declaração|recibo|factura|fatura|nif|contribuinte|empresa|registado)\b/.test(msgLower),
  };
};

const detectarIdioma = (msgLower) => {
  const padroes = {
    pt: /\b(olá|obrigado|por favor|como está|tudo bem|sim|não|kamba|mano|fixe|massa|yha|eish|poupar|gasto|saldo|kwanza|kumbú)\b/i,
    en: /\b(hello|thank you|please|how are you|yes|no|help|money|balance|savings|invest)\b/i,
  };

  const scores = {};
  for (const [idioma, padrao] of Object.entries(padroes)) {
    const matches = msgLower.match(padrao);
    scores[idioma] = matches ? matches.length : 0;
  }

  if (scores.pt > scores.en) return 'pt-AO';
  if (scores.en > scores.pt) return 'en';
  return 'pt-AO';
};

const detectarSentimento = (msgLower) => {
  const positivo = /\b(obrigad|valeu|fixe|top|excelente|perfeito|bom|ótimo|ótimo|massa|adorei|gostei|show|massa|incrível|aliviado|grato)\b/i;
  const frustracao = /\b(não consigo|impossível|desisto|bati na parede|bater na parede|sem dinheiro|quebrado|tô liso|estou liso|sem kumbú)\b/i;
  const negativo = /\b(raiva|ódio|odio|frustrad|chatead|triste|mau|pior|desgraça|problema|dawa|chato|aborrecido)\b/i;
  const urgente = /\b(urgente|agora|já|rápido|imediato|socorro|emergência|preciso agora)\b/i;
  const ansioso = /\b(preocupado|ansioso|medo|receio|nervoso|aflito)\b/i;

  if (urgente.test(msgLower)) return { sentimento: 'urgente', intensidade: 0.9 };
  if (frustracao.test(msgLower)) return { sentimento: 'frustracao', intensidade: 0.85 };
  if (ansioso.test(msgLower)) return { sentimento: 'ansioso', intensidade: 0.7 };
  if (negativo.test(msgLower)) return { sentimento: 'negativo', intensidade: 0.7 };
  if (positivo.test(msgLower)) return { sentimento: 'positivo', intensidade: 0.7 };

  // Detectar urgência por exclamações múltiplas
  if ((msgLower.match(/!/g) || []).length >= 2) {
    return { sentimento: 'urgente', intensidade: 0.5 };
  }

  return { sentimento: 'neutro', intensidade: 0.5 };
};

module.exports = {
  classificarIntencao,
  extrairEntidades,
  detectarIdioma,
  detectarSentimento
};
