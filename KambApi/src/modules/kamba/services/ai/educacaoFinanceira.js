const CONCEITOS = [
  {
    tema: 'inflação',
    titulo: 'O que é Inflação?',
    explicacao: 'Inflação é o aumento geral dos preços. Em Angola, a inflação faz com que o kwanza perca poder de compra ao longo do tempo. O que compravas com 1000 AOA mês passado pode custar 1050 AOA este mês.',
    dica: 'Para proteger teu dinheiro da inflação, considera investir em activos que valorizam (dólar, imobiliário) ou em certificados do tesouro que pagam acima da inflação.'
  },
  {
    tema: 'juros_compostos',
    titulo: 'Juros Compostos',
    explicacao: 'Juros compostos são "juros sobre juros". É o motor do crescimento do teu dinheiro ao longo do tempo. Se poupares 10,000 AOA/mês com rendimento de 1% ao mês, em 5 anos tens ~820,000 AOA (não apenas 600,000).',
    dica: 'Começa cedo: quanto mais tempo o dinheiro render, maior o efeito dos juros compostos. Mesmo valores pequenos fazem diferença a longo prazo.'
  },
  {
    tema: 'fundo_emergencia',
    titulo: 'Fundo de Emergência',
    explicacao: 'Fundo de emergência é dinheiro guardado para imprevistos: doença, desemprego, reparação do carro. Deve ser de fácil acesso (não investido) e cobrir 3-6 meses de despesas.',
    dica: 'Começa com uma meta pequena: 50,000 AOA. Depois aumenta para 1 mês de gastos. Até chegar a 6 meses. Um passo de cada vez!'
  },
  {
    tema: 'regra_50_30_20',
    titulo: 'Regra 50/30/20',
    explicacao: 'A regra 50/30/20 ajuda a organizar o orçamento: 50% da renda para necessidades (casa, comida, transporte), 30% para desejos (lazer, jantar fora), 20% para poupança e investimentos.',
    dica: 'Se 50% para necessidades é pouco para tua realidade (comum em Luanda), ajusta: 60/20/20 ou 70/10/20. O importante é poupar sempre os 20%.'
  },
  {
    tema: 'dolarizacao',
    titulo: 'Dolarização em Angola',
    explicacao: 'Muitos angolanos guardam dinheiro em dólar para proteger da desvalorização do kwanza. Isto chama-se dolarização. Mas atenção: ter só dólar também tem risco (variação do câmbio, dificuldade de usar no dia-a-dia).',
    dica: 'Diversifica: parte em kwanza (para despesas do dia), parte em dólar (para reserva), parte em investimentos (certificados, imobiliário). Não ponhas todos os ovos no mesmo cesto!'
  },
  {
    tema: 'orcamento',
    titulo: 'Como Fazer um Orçamento',
    explicacao: 'Orçamento é um plano de gastos. Primeiro: regista TUDO que ganhas e gastas durante um mês. Depois: categoriza e vê onde podes cortar. A app KambaPro facilita isso!',
    dica: 'O primeiro orçamento nunca é perfeito. Ajusta mês a mês. O importante é criar o hábito de registar os gastos.'
  },
  {
    tema: 'poupança',
    titulo: 'Poupança Inteligente',
    explicacao: 'Poupar não é "guardar o que sobra", é "separar primeiro". Quando recebes o salário, tira logo os 10-20% para poupança. O que resta é para gastar.',
    dica: 'Automatiza: configura uma transferência automática no dia do salário para uma conta poupança. Se não vês o dinheiro, não gastas!'
  },
  {
    tema: 'credito',
    titulo: 'Crédito e Dívidas',
    explicacao: 'Crédito pode ser útil (comprar casa, investir no negócio) ou perigoso (gastar mais do que tens). A regra de ouro: nunca uses crédito para consumo (roupa, jantar, lazer).',
    dica: 'Se tens dívidas no cartão ou crédito pessoal, prioriza pagá-las. Os juros do crédito ao consumo em Angola podem chegar a 10-15% ao mês!'
  },
];

const DICAS_DIARIAS = [
  "Revisa teus gastos da semana. Pequenos escapes (café, água, pastel) somam muito no fim do mês! ☕",
  "Desafio do dia: passa 24h sem gastar nada. Só pelo desafio, para veres se consegues! ⏰",
  "Sabias que cozinhar em casa pode poupar até 60% comparado a comer na rua? Bora tentar? 🍳",
  "Abre a app e vê quantas assinaturas tens (streaming, apps). Cancele as que não usas há mais de 1 mês. 📱",
  "Desafio da semana: regista TODOS os gastos, até os de 50 AOA. No fim da semana, revê. 📝",
  "Se recebeste hoje, separa logo 10% para poupança. Não espera o fim do mês! 💰",
  "Compara preços antes de comprar. Em Luanda, o mesmo produto pode variar 30% entre lojas. 🏪",
  "Desafio do mês: reduz gastos em lazer em 20% e mete a diferença no fundo de emergência. 🛡️",
  'Sabias que a app KambaPro pode analisar teus gastos por categoria? Pede "análise de gastos" ao Kamba! 📊',
  "Pequenas poupanças diárias de 500 AOA = 15,000 AOA/mês = 180,000 AOA/ano. Faz a conta! 🧮",
];

const DESAFIOS_MENSAIS = [
  {
    nome: 'Mês Sem Gastos Supérfluos',
    descricao: 'Durante 30 dias, não gastes em nada que não seja essencial (comida, transporte, saúde). Vê quanto poupas!',
    dica: 'No final, usa o valor poupado para iniciar ou reforçar teu fundo de emergência.'
  },
  {
    nome: 'Mês do Orçamento Rigoroso',
    descricao: 'Define um orçamento para cada categoria no início do mês e não ultrapasses. A app KambaPro pode ajudar a monitorizar.',
    dica: 'Sê realista: um orçamento muito apertado é difícil de cumprir. Dá-te alguma margem.'
  },
  {
    nome: 'Mês da Poupança Acelerada',
    descricao: 'Tenta poupar 30% da tua renda este mês (em vez dos 20% recomendados). Corta em lazer, refeições fora, e transportes.',
    dica: 'O esforço extra de um mês pode dar um bom empurrão no teu fundo de emergência.'
  },
  {
    nome: 'Mês de Educação Financeira',
    descricao: 'Lê um artigo ou vê um vídeo sobre finanças por semana. Takes de 10-15 minutos por semana já fazem diferença.',
    dica: 'Pergunta ao Kamba sobre os conceitos que não entenderes. Estou aqui para ajudar!'
  },
];

const getConceitoAleatorio = () => {
  return CONCEITOS[Math.floor(Math.random() * CONCEITOS.length)];
};

const getDicaDiaria = () => {
  const dia = new Date().getDate();
  return DICAS_DIARIAS[dia % DICAS_DIARIAS.length];
};

const getDesafioMensal = () => {
  const mes = new Date().getMonth();
  return DESAFIOS_MENSAIS[mes % DESAFIOS_MENSAIS.length];
};

const buscarConceito = (tema) => {
  return CONCEITOS.find(c =>
    c.tema.toLowerCase().includes(tema.toLowerCase()) ||
    c.titulo.toLowerCase().includes(tema.toLowerCase())
  ) || null;
};

module.exports = {
  CONCEITOS,
  DICAS_DIARIAS,
  DESAFIOS_MENSAIS,
  getConceitoAleatorio,
  getDicaDiaria,
  getDesafioMensal,
  buscarConceito
};
