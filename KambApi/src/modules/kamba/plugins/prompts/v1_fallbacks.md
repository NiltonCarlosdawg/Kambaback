# Respostas de Fallback do Kamba

## erro_generico

- "Eish, deu um dawa técnico aqui! 😅 Mas não te preocupes, tenta de novo daqui a pouco."
- "Mano, o sistema deu uma travada. 🐢 Aguarda uns minutinhos e tenta novamente, yha?"
- "Kamba, deu bug! 💪 Estamos a resolver. Tenta de novo mais tarde."

## nao_entendido

- "Não apanhei bem, mano. Queres saber sobre:\n• Saldo\n• Gastos\n• Metas\n• Dicas de poupança\n• Cotação do dólar"
- "Mmm, não percebi. Experimenta:\n• 'Qual é o meu saldo?'\n• 'Criar meta'\n• 'Como poupar?'"
- "Confuso aqui, kamba. Digita 'ajuda' para ver o que posso fazer! 🤔"
- "Não entendi bem, kamba. Tenta ser mais direto, yha?"

## sem_dados

- "Ainda não tens dados suficientes, mano. Adiciona alguns gastos primeiro! 📊"
- "Epa, tá vazio aqui! Regista movimentos na app para eu te ajudar melhor."
- "Preciso de mais info, kamba. Vai na app e adiciona gastos ou metas."

## api_offline

- "O cérebro tá offline agora. 🧠 Tenta em alguns minutos, yha?"
- "Sistema sobrecarregado, kamba. Aguarda uns 2 minutos e volta."
- "Servidor ocupado. Relaxa um pouco e tenta de novo! 😌"

## offline_inteligente

Respostas para quando o LLM está offline mas o utilizador faz perguntas comuns.

### dolar

"Eish, mano! O dólar anda volátil em Angola. A taxa oficial do BNA anda nos 830-850 AOA, mas no mercado paralelo pode chegar a 1000+. A minha dica: se tens kwanzas e queres proteger do poder de compra, considera diversificar. Mas lembra: nunca metas todo o kumbú numa só moeda! 💱"

### negocio

"Com 100 mil kwanzas dá para começar, kamba! Em Angola, negócios com baixo investimento inicial funcionam bem:\n• Revenda de produtos - compra no zango e revende\n• Serviços digitais (design, redes sociais)\n• Venda de alimentos (marmitas, bolos)\n• Transporte (kupapata)\n\nO importante é começar pequeno e reinvestir os lucros. 🚀"

### poupar

"Poupar em Angola é um desafio, kamba, mas é possível! A regra de ouro: guarda pelo menos 10% da tua renda assim que recebes. Tenta a regra 50/30/20: 50% necessidades, 30% desejos, 20% poupança. E evita gastar tudo no fim de semana! 😅"

### investir

"Investir em Angola tem opções limitadas mas existem, mano:\n• Certificados do Tesouro (BNA)\n• Depósitos a prazo nos bancos\n• Imobiliário\n• Microcrédito\n\nLembra: nunca investes dinheiro que precisas para viver! 🏦"

## respostas_frustracao

Usar quando sentimento = 'frustracao' (prefixo antes do conteúdo principal)

- "Eish, percebo que a situação está a pesar, kamba. Vamos ver o que dá para fazer."
- "Isso é difícil yha, mano. Mas vamos olhar para isto juntos — passo a passo."
- "Entendo a frustração. Sem julgamento — vamos ver de onde vem o problema."

## respostas_urgente

Usar quando sentimento = 'urgente' (prefixo antes do conteúdo principal)

- "Ok, situação urgente — vamos directo ao ponto."
- "Percebido, kamba. Foca: o que precisas de resolver agora?"
- "Vamos resolver isto já. Diz-me mais: [pergunta directa ao problema]"

## respostas_saldo_zero

Usar quando saldoTotal = 0 e utilizador tem metas activas

- "Kamba, vi que o saldo está em zero com metas activas. Antes de qualquer conselho, vamos estabilizar primeiro — faz sentido?"
- "Honestamente, mano: com saldo zero o foco tem de ser estabilização, não crescimento. Vamos lá."

## respostas_sem_renda

Usar quando rendaMensalMedia não está configurada

- "Para te dar conselhos que fazem sentido para ti, preciso de saber quanto recebes. Podes partilhar uma estimativa?"
- "Sem saber a tua renda não consigo calcular nada de útil, kamba. Tens ideia do valor mensal?"

## respostas_pergunta_repetida

Usar quando contextoPendente contém 'pergunta_repetida'

- "Já falámos sobre isso antes, kamba. Da última vez o que impediu de avançar?"
- "Esta questão voltou — acho que o problema é outro. O que está mesmo a travar?"
- "Mano, já abordámos este tema. Queres que tentemos uma abordagem diferente desta vez?"
