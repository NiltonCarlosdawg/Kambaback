// services/ai/promptBuilder.js
// Builder de prompts com templates versionados para o Kamba

const fs = require("fs");
const path = require("path");

const PROMPTS_DIR = path.join(__dirname, "../../plugins/prompts");

/**
 * Carrega um template de ficheiro ou usa fallback
 * @param {string} name - Nome do template (ex: 'v1_system')
 * @returns {string} Conteúdo do template
 */
const carregarTemplate = (name) => {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return null;
};

/**
 * F-010: sanitiza texto livre do utilizador (nome, morada) antes de o injetar
 * no system prompt — remove quebras de linha (fuga de bloco), marcadores
 * [type:...] (spoof de marcadores como WIZARD) e limita o comprimento.
 */
const sanitizarCampoPrompt = (valor, fallback = "", max = 120) => {
  const texto = String(valor ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[[\]<>]/g, "")
    .trim()
    .substring(0, max);
  return texto || fallback;
};

/**
 * Gera instruções operacionais de perfil de risco
 */
const gerarInstrucoesRisco = (perfilDeRisco) => {
  const instrucoes = {
    CONSERVADOR: `Perfil CONSERVADOR:
- Prioriza SEMPRE a segurança do capital sobre o retorno.
- Menciona o risco ANTES do retorno potencial em qualquer sugestão.
- Recomenda: depósitos a prazo, certificados do tesouro, fundo de emergência robusto.
- NUNCA sugeres: cripto, acções, negócios de alto risco, empréstimos para investir.
- Quando perguntado "devo arriscar?", a resposta base é não — explica porquê.`,

    MODERADO: `Perfil MODERADO:
- Equilibra segurança e crescimento.
- Podes sugerir diversificação (70% seguro, 30% crescimento).
- Recomenda: mix de depósitos a prazo + pequena posição em dólar + fundo de emergência.
- Aceita algum risco calculado se o utilizador tiver fundo de emergência constituído.`,

    AGRESSIVO: `Perfil AGRESSIVO:
- O utilizador aceita volatilidade por retorno maior.
- Podes discutir alternativas de maior risco: negócios, imobiliário, mercado paralelo.
- Mas SEMPRE com a condição: fundo de emergência intacto antes de qualquer investimento.
- Apresenta cenários pessimistas e optimistas — nunca só o cenário optimista.`,
  };
  return instrucoes[perfilDeRisco] || instrucoes["MODERADO"];
};

/**
 * Gera instrução de tom baseada na idade
 */
const gerarInstrucaoIdade = (idade) => {
  if (!idade || idade === "não informada") return "";
  const idadeNum = parseInt(idade);
  if (idadeNum < 25)
    return "Utilizador jovem (< 25 anos): horizonte longo, foca em hábitos e educação financeira. Pode assumir mais risco de longo prazo. Usa referências culturais da geração Z angolana.";
  if (idadeNum < 35)
    return "Utilizador em início de carreira (25-34): foca em construir base (fundo de emergência, primeiro investimento). Equilibra curto e longo prazo.";
  if (idadeNum < 50)
    return "Utilizador em fase produtiva (35-49): foca em crescimento e protecção de activos. Planeamento de médio prazo relevante.";
  return "Utilizador sénior (50+): prioriza protecção e rendimento estável. Horizonte mais curto — evita riscos desnecessários.";
};

/**
 * Detecta dados em falta para onboarding
 */
const detectarDadosEmFalta = (perfil, contextoFinanceiro) => {
  const emFalta = [];
  if (!perfil?.rendaMensalMedia || perfil.rendaMensalMedia === 0)
    emFalta.push("renda mensal");
  if (contextoFinanceiro?.numContas === 0) emFalta.push("conta ou cartão");
  if (contextoFinanceiro?.gastosEsteMes?.numTransacoes === 0)
    emFalta.push("gastos registados");
  return emFalta;
};

/**
 * Selecciona e preenche o template correcto baseado na situação
 */
const gerarSystemPrompt = (
  perfil,
  idade,
  contextoFormatado = "",
  contextoFinanceiro = null,
  opcoes = {},
) => {
  const hoje = new Date().toLocaleDateString("pt-AO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const {
    sentimento = "neutro",
    sentimentoIntensidade = 0.5,
    contextoPendente = "nenhum",
  } = opcoes;

  const situacao = contextoFinanceiro?.situacaoFinanceira;
  const dadosEmFalta = detectarDadosEmFalta(perfil, contextoFinanceiro);

  // Seleccionar template
  let templateNome = "v1_system";
  if (
    dadosEmFalta.length >= 2 ||
    (dadosEmFalta.includes("renda mensal") &&
      dadosEmFalta.includes("conta ou cartão"))
  ) {
    templateNome = "v1_system_novo_user";
  } else if (situacao?.codigo === "critica") {
    templateNome = "v1_system_critico";
  }

  const template =
    carregarTemplate(templateNome) || carregarTemplate("v1_system");
  if (!template) {
    // Fallback hardcoded mínimo
    return `És o Kamba, consultor financeiro angolano. Nome do utilizador: ${perfil?.nome || "kamba"}. Data: ${hoje}. Responde em português de Angola, tom casual e directo.`;
  }

  // Detectar zona de Luanda
  const detectarZonaLuanda = (morada) => {
    if (!morada) return 'não identificada';
    const m = morada.toLowerCase();
    const zonas = {
      'premium (Miramar, Talatona, Belas)': ['miramar', 'alvalade', 'talatona', 'belas', 'ilha'],
      'classe média (Kilamba, Sequele, Viana)': ['kilamba', 'sequele', 'camama', 'viana', 'zango'],
      'popular (Cazenga, Rangel, Sambizanga)': ['cazenga', 'rangel', 'hoji', 'sambizanga', 'cacuaco'],
      'centro (Ingombota, Maianga, Samba)': ['ingombota', 'maianga', 'samba', 'prenda']
    };
    for (const [nome, palavras] of Object.entries(zonas)) {
      if (palavras.some(p => m.includes(p))) return nome;
    }
    return 'Luanda (zona não identificada)';
  };

  const tipoRendaMap = {
    'FIXO': 'FIXO (salário fixo)',
    'VARIAVEL': 'VARIAVEL (rendimento variável/irregular)',
    'MISTO': 'MISTO (fixo + variável)',
    'INFORMAL': 'INFORMAL (economia informal/biscates)'
  };

  // Preencher variáveis comuns
  // F-010: nome/morada são texto livre do utilizador dentro do system prompt —
  // sem sanitização, quebras de linha ou marcadores deixavam "fugir" do bloco
  // UTILIZADOR e fazer-se passar por instruções
  let prompt = template
    .replace(/{{NOME}}/g, sanitizarCampoPrompt(perfil?.nome, "kamba"))
    .replace(/{{MORADA}}/g, sanitizarCampoPrompt(perfil?.morada, "Luanda"))
    .replace(/{{ZONA_LUANDA}}/g, detectarZonaLuanda(perfil?.morada))
    .replace(/{{TIPO_RENDA}}/g, tipoRendaMap[perfil?.tipoRenda] || 'Não definido')
    .replace(/{{IDADE}}/g, idade || "não informada")
    .replace(
      /{{RENDA}}/g,
      perfil?.rendaMensalMedia
        ? `${Number(perfil.rendaMensalMedia).toLocaleString("pt-AO")} AOA/mês`
        : "não configurada — pedir ao utilizador",
    )
    .replace(/{{RISCO}}/g, perfil?.perfilDeRisco || "MODERADO")
    .replace(/{{DATA}}/g, hoje)
    .replace(/{{CONTEXTO_FINANCEIRO}}/g, contextoFormatado || "")
    .replace(/{{SENTIMENTO}}/g, sentimento)
    .replace(
      /{{SENTIMENTO_INTENSIDADE}}/g,
      sentimentoIntensidade >= 0.8
        ? "alta"
        : sentimentoIntensidade >= 0.5
          ? "média"
          : "baixa",
    )
    .replace(/{{SITUACAO_FINANCEIRA}}/g, situacao?.codigo || "desconhecida")
    .replace(/{{SITUACAO_FINANCEIRA_DETALHE}}/g, situacao?.detalhe || "")
    .replace(/{{CONTEXTO_PENDENTE}}/g, contextoPendente)
    .replace(
      /{{INSTRUCOES_RISCO}}/g,
      gerarInstrucoesRisco(perfil?.perfilDeRisco),
    )
    .replace(/{{INSTRUCAO_IDADE}}/g, gerarInstrucaoIdade(idade))
    .replace(/{{DADOS_EM_FALTA}}/g, dadosEmFalta.join(", ") || "nenhum");

  return prompt;
};

/**
 * Gera prompt minimal para conversas casuais — agora usa template externo
 */
const gerarPromptMinimal = (perfil) => {
  const template = carregarTemplate("v1_minimal");
  if (template) {
    return template.replace(/{{NOME}}/g, perfil?.nome || "kamba");
  }
  // Fallback
  return `És o Kamba, bró financeiro angolano. Utilizador: ${perfil?.nome || "kamba"}. Responde de forma casual e curta (máx 2 frases). Tom: quente, angolano.`;
};

/**
 * Gera prompt para sumarização de conversas
 * @param {Array} mensagens - Array de mensagens para sumarizar
 * @returns {string} Prompt de sumarização
 */
const gerarPromptSumarizacao = (mensagens) => {
  const texto = mensagens.map((m) => `${m.role}: ${m.content}`).join("\n");
  return `Resume a seguinte conversa em 2-3 frases curtas, mantendo os pontos financeiros importantes:\n\n${texto}\n\nSumário:`;
};

/**
 * Gera prompt para classificação de intenção
 * @param {string} mensagem - Mensagem do utilizador
 * @returns {string} Prompt de classificação
 */
const gerarPromptClassificacao = (mensagem) => {
  return `Classifica a intenção da seguinte mensagem numa única palavra: [saudacao, dados_financeiros, cotacao, negocio, poupar, investir, educacao, ajuda, casual, outro]\n\nMensagem: "${mensagem}"\n\nIntenção:`;
};

module.exports = {
  gerarSystemPrompt,
  gerarPromptMinimal,
  gerarPromptSumarizacao,
  gerarPromptClassificacao,
  carregarTemplate,
  gerarInstrucoesRisco,
  detectarDadosEmFalta,
};
