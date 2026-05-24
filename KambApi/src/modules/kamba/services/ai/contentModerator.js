const { getClient, isModerationSupported } = require("./openaiClient");

const PATTERNS_PROIBIDOS = {
  odio_racial:
    /\b(n(?:egr?[aoiu]|azis[cta]|azi)|pret(?:o|a)\s+nojento|raça\s+inferior|suj(?:o|a)\s+(?:preto|branco)|branco\s+nojento)\b/i,
  odio_religioso:
    /\b(m(?:uçulman[ao]|acom)|evang?[eé]lic[ao]\s+(?:nojento|lixo)|deus\s+não\s+existe|religião\s+é\s+lixo|ateu\s+nojento)\b/i,
  violencia:
    /\b(?:vou\s+te\s+(?:matar|pegar|destruir|estourar)|te\s+(?:mato|estouro|pego)|quero\s+(?:matar?r?)\s+(?:algu[ée]m|todo|voc[êe])|morr(?:e|a)\s+(?:sua|seu)|vai\s+(?:morrer|pagar)|corte\s+(?:sua|teu)\s+(?:garganta|cabeça)|te\s+(?:corto|retalho)|vou\s+(?:explodir|bombar))\b/i,
  sexual_explicito:
    /\b(?:porn[ôo]|xxx\s*(?:video|conteudo|site)|sexo\s+(?:expl[ií]cito|gratis|ao\s+vivo)|conteudo\s+adulto|menor\s+de\s+idade|nudes\b|fuck\s+you|put[ao]\s+(?:que\s+te|merda))\b/i,
  autolesao:
    /\b(?:quero\s+(?:morrer|me\s+matar|tirar\s+a\s+vida)|suic[ií]dio|vou\s+me\s+(?:matar|suicidar)|cortar\s+(?:os\s+)?pulsos|acabar\s+com\s+(?:minha\s+)?vida|não\s+quero\s+mais\s+viver)\b/i,
  assedio:
    /\b(?:gostosas?|gostos[ao]|vem\s+c[áa]|me\s+da\s+o\s+teu\s+(?:numero|whatsapp|zap)|quero\s+te\s+(?:comer|pegar)|chama\s+no\s+pv|dm\s+me|bate\s+uma)\b/i,
};

const RESPOSTA_BLOQUEIO = {
  odio_racial:
    "Eish, kamba! Aqui não é lugar para esse tipo de conversa. Fala-me das tuas finanças!  Se quiseres, posso ajudar com dicas de poupança, gestão de gastos ou criar metas.",
  odio_religioso:
    "Mano, respeito é a base. Vamos focar no que interessa: a tua saúde financeira!  Queres saber quanto gastaste este mês?",
  violencia:
    "Isso não é conversa para aqui, kamba.  Relaxa e vamos falar de dinheiro — é melhor para todos. Queres ver o teu saldo?",
  sexual_explicito:
    "Epa, kamba! Bora manter o foco nas finanças.  Tenho ótimas dicas de poupança se quiseres!",
  autolesao:
    "Olha, kamba, se estás a passar por um momento difícil, procura ajuda profissional.  A Saúde Mental é importante. Liga para o SOS Voz Amiga (1414) ou fala com alguém de confiança.  Mas sobre finanças, estou aqui para ajudar.",
  assedio:
    "Kamba, isso não é legal.  Vamos manter o respeito. Queres saber sobre os teus gastos ou criar uma meta?",
  generico:
    "Eish, eso não é assunto para aqui, kamba.  Fala-me das tuas finanças!",
};

const detectarCategoria = (texto) => {
  for (const [categoria, padrao] of Object.entries(PATTERNS_PROIBIDOS)) {
    if (padrao.test(texto)) {
      return categoria;
    }
  }
  return null;
};

const moderarComOpenAI = async (texto) => {
  if (!isModerationSupported()) return null;

  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.moderations.create({ input: texto });
    const result = response.results[0];

    if (result.flagged) {
      const categoriasFlagged = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([cat]) => cat);

      return {
        bloqueado: true,
        categorias: categoriasFlagged,
        scores: Object.fromEntries(
          Object.entries(result.category_scores).filter(
            ([, score]) => score > 0.1,
          ),
        ),
      };
    }

    return { bloqueado: false };
  } catch (err) {
    console.warn("[MODERACAO] OpenAI API error:", err.message);
    return null;
  }
};

const moderarInput = async (texto) => {
  if (!texto || typeof texto !== "string") return { bloqueado: false };

  const textoLower = texto.toLowerCase().trim();

  const aiResult = await moderarComOpenAI(textoLower);
  if (aiResult && aiResult.bloqueado) {
    return {
      bloqueado: true,
      categoria: aiResult.categorias[0] || "conteudo_inadequado",
      razao: `Conteúdo classificado como: ${aiResult.categorias.join(", ")}`,
    };
  }

  if (aiResult && !aiResult.bloqueado) {
    return { bloqueado: false };
  }

  const categoria = detectarCategoria(textoLower);
  if (categoria) {
    return {
      bloqueado: true,
      categoria,
      razao: `Conteúdo bloqueado por padrão: ${categoria}`,
    };
  }

  return { bloqueado: false };
};

const moderarOutput = async (texto) => {
  if (!texto || typeof texto !== "string") return { bloqueado: false };

  const aiResult = await moderarComOpenAI(texto);
  if (aiResult) return aiResult;

  const categoria = detectarCategoria(texto);
  if (categoria) {
    return {
      bloqueado: true,
      categoria,
      razao: `Conteúdo bloqueado por padrão: ${categoria}`,
    };
  }

  return { bloqueado: false };
};

const getRespostaBloqueio = (categoria) => {
  return RESPOSTA_BLOQUEIO[categoria] || RESPOSTA_BLOQUEIO.generico;
};

module.exports = {
  moderarInput,
  moderarOutput,
  getRespostaBloqueio,
  detectarCategoria,
};
