const fallbackRespostas = {
  erro_generico: [
    "Eish, deu um dawa técnico aqui!  Mas não te preocupes, tenta de novo daqui a pouco.",
    "Mano, o sistema deu uma travada.  Aguarda uns minutinhos e tenta novamente, yha?",
    "Kamba, deu bug!  Estamos a resolver. Tenta de novo mais tarde. 💪"
  ],
  nao_entendido: [
    "Não apanhei bem, mano. Queres saber sobre:\n•  Saldo\n•  Gastos\n•  Metas\n•  Dicas de poupança\n•  Cotação do dólar",
    "Mmm, não percebi. Experimenta:\n• 'Qual é o meu saldo?'\n• 'Criar meta'\n• 'Como poupar?'",
    "Confuso aqui, kamba. Digita 'ajuda' para ver o que posso fazer!",
    "Não entendi bem, kamba. Tenta ser mais direto, yha?"
  ],
  sem_dados: [
    "Ainda não tens dados suficientes, mano. Adiciona alguns gastos primeiro!",
    "Epa, tá vazio aqui! Regista movimentos na app para eu te ajudar melhor.",
    "Preciso de mais info, kamba. Vai na app e adiciona gastos ou metas."
  ],
  api_offline: [
    "O cérebro tá offline agora.  Tenta em alguns minutos, yha?",
    "Sistema sobrecarregado, kamba. Aguarda uns 2 minutos e volta.",
    "Servidor ocupado. Relaxa um pouco e tenta de novo! "
  ]
};

const getFallback = (tipo) => {
  const lista = fallbackRespostas[tipo] || fallbackRespostas.erro_generico;
  return lista[Math.floor(Math.random() * lista.length)];
};

const getRespostaOffline = (msgLower) => {
  if (msgLower.includes('dolar') || msgLower.includes('dólar') || msgLower.includes('usd')) {
    return "Eish, mano! O dólar anda volátil em Angola. A taxa oficial do BNA anda nos 830-850 AOA, mas no mercado paralelo pode chegar a 1000+. " +
           "A minha dica: se tens kwanzas e queres proteger do poder de compra, considera diversificar. " +
           "Mas lembra: nunca metas todo o kumbú numa só moeda! 💱";
  }

  if (msgLower.includes('negocio') || msgLower.includes('negócio') || msgLower.includes('empreender')) {
    return "Com 100 mil kwanzas dá para começar, kamba! Em Angola, negócios com baixo investimento inicial funcionam bem:\n" +
           "• Revenda de produtos - compra no zango e revende\n" +
           "• Serviços digitais (design, redes sociais)\n" +
           "• Venda de alimentos (marmitas, bolos)\n" +
           "• Transporte (kupapata)\n\n" +
           "O importante é começar pequeno e reinvestir os lucros. 🚀";
  }

  if (msgLower.includes('poupar') || msgLower.includes('economizar')) {
    return "Poupar em Angola é um desafio, kamba, mas é possível! " +
           "A regra de ouro: guarda pelo menos 10% da tua renda assim que recebes. " +
           "Tenta a regra 50/30/20: 50% necessidades, 30% desejos, 20% poupança. " +
           "E evita gastar tudo no fim de semana! 😅";
  }

  if (msgLower.includes('investir') || msgLower.includes('investimento')) {
    return "Investir em Angola tem opções limitadas mas existem, mano:\n" +
           "• Certificados do Tesouro (BNA)\n" +
           "• Depósitos a prazo nos bancos\n" +
           "• Imobiliário\n" +
           "• Microcrédito\n\n" +
           "Lembra: nunca investes dinheiro que precisas para viver! 🏦";
  }

  return getFallback('api_offline');
};

const kambaRes = (res, texto, extra = {}) => {
  return res.json({
    success: true,
    kamba: true,
    mensagem: texto,
    timestamp: new Date().toISOString(),
    ...extra
  });
};

module.exports = {
  kambaRes,
  getFallback,
  getRespostaOffline,
  fallbackRespostas
};
