// src/controllers/kambaController.js
const prisma = require('../lib/prisma');
const Insights = require('./insightsController'); 

const GROQ_API_KEY = process.env.KAMBA_AI_API_KEY; 
const GROQ_BASE_URL = process.env.KAMBA_AI_BASE_URL; 
const GROQ_MODEL = process.env.KAMBA_AI_MODEL || 'gpt-oss-120b'; 

const availableTools = [
    {
        type: "function",
        function: {
            name: "getFluxoCaixaMensal",
            description: "Obtém as receitas, despesas e poupança líquida do mês atual para avaliar cash flow.",
            parameters: { type: "object", properties: {} },
        }
    },
    {
        type: "function",
        function: {
            name: "getResumoObjetivos",
            description: "Obtém o progresso de todos os objetivos financeiros (metas) do usuário.",
            parameters: { type: "object", properties: {} },
        }
    },
    {
        type: "function",
        function: {
            name: "getFundoEmergenciaStatus",
            description: "Verifica se o saldo de reserva cobre a despesa média mensal (meses de reserva).",
            parameters: { type: "object", properties: {} },
        }
    }
];

const kambaRes = (res, texto) => {
    return res.json({
        success: true,
        kamba: true,
        mensagem: texto,
        timestamp: new Date().toISOString()
    });
};

const conversarComKamba = async (req, res, next) => {
    try {
        const { mensagem, historico = [] } = req.body;
        const usuarioId = req.user.id;

        if (!mensagem || typeof mensagem !== 'string') {
            return kambaRes(res, "Diz aí, kamba! O que queres saber hoje? Saldo? Último gasto? Objetivo?");
        }

        const msg = mensagem.toLowerCase().trim();

        // 1. BUSCA DE PERFIL COMPLETO
        const perfil = await prisma.user.findUnique({
            where: { id: usuarioId },
            select: {
                nome: true, morada: true, sexo: true,
                dataNascimento: true, rendaMensalMedia: true, perfilDeRisco: true
            }
        });

        const idade = perfil?.dataNascimento 
            ? new Date().getFullYear() - new Date(perfil.dataNascimento).getFullYear() 
            : 'não informada';

        // 2. REGRAS HEURÍSTICAS (Respostas Instantâneas para comandos comuns)
        if (msg.includes('saldo') || msg.includes('quanto tenho')) {
            const cartoes = await prisma.cartao.findMany({ where: { usuarioId, ativo: true } });
            const total = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual || 0), 0);
            return kambaRes(res, `Tens *${total.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}* no total! Bora gastar com cabeça, kamba!`);
        }

        if (msg.includes('último gasto') || msg.includes('comprei')) {
            const ultimo = await prisma.gasto.findFirst({
                where: { usuarioId, excluido: false },
                orderBy: { data: 'desc' },
                include: { categoria: true }
            });
            if (!ultimo) return kambaRes(res, 'Ainda não tens nenhum gasto registrado, mano!');
            return kambaRes(res, `Teu último gasto foi *${Number(ultimo.valor).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}* em *${ultimo.categoria?.nome || 'Geral'}*.`);
        }

        // 3. IA AVANÇADA (GPT-OSS-120B) - MESCLAGEM DE REGRAS
        if (!GROQ_API_KEY) return kambaRes(res, 'IA offline. Configura a API Key!');

        let messages = [
            {
                role: "system",
                content: `Tu és o KAMBA, assistente virtual de gestão financeira focado na realidade de Angola.

                DADOS DO UTILIZADOR ATUAL:
                - Nome: ${perfil.nome}
                - Localização: ${perfil.morada}
                - Idade: ${idade} anos
                - Renda: ${perfil.rendaMensalMedia} AOA
                - Perfil de Risco: ${perfil.perfilDeRisco}

                ### Missão e Tom:
                - Quando o usuário te cumprimentar, responde com uma saudação e pergunte apenas (como posso ajudar-te hoje?).
                - Comunica em português angolano, usando gírias moderadas (kamba, mambo, kumbú, garra).
                - Considera o contexto económico local (inflação, custo de vida em ${perfil.morada}, Kwanza).
                - Adapta o conselho à classe económica do utilizador (baixa, média ou alta) com base na renda de ${perfil.rendaMensalMedia} AOA.
                - Sê motivador, prático e respeitoso. Nunca ridicularizes dificuldades.

                ### Regras de Operação:
                1. Personalização: Usa os dados do perfil e as 'tools' para fundamentar respostas sobre poupança ou gastos.
                2. Honestidade: Se os dados forem insuficientes, solicita a informação antes de aconselhar.
                3. Segurança: Nunca prometas dinheiro fácil. Prioriza estabilidade e fundo de emergência.
                4. Memória: Utiliza o histórico de mensagens para dar continuidade à conversa.

                ### Instruções Técnicas:
                - Mantém respostas curtas e objetivas.
                - Sempre que possível, usa as tools: getFluxoCaixaMensal, getResumoObjetivos ou getFundoEmergenciaStatus.`
            }
        ];

        // Adiciona histórico de memória (15 mensagens)
        const historicoMapeado = historico.slice(-15).map(h => ({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.text
        }));

        messages.push(...historicoMapeado);
        messages.push({ role: "user", content: mensagem });

        // --- CHAMADA 1: DECISÃO DA IA ---
        let response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: messages,
                tools: availableTools,
                tool_choice: "auto",
                temperature: 0.6,
                max_tokens: 800
            })
        });

        let data = await response.json();
        let finalContent;

        if (data.choices?.[0]?.message?.tool_calls) {
            const toolCall = data.choices[0].message.tool_calls[0];
            const functionName = toolCall.function.name;
            
            console.log(`[KAMBA IA 120B] Tool: ${functionName}`);

            const toolResult = typeof Insights[functionName] === 'function' 
                ? await Insights[functionName](usuarioId)
                : { erro: "Função não encontrada" };

            messages.push(data.choices[0].message);
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });

            let secondResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: GROQ_MODEL, messages: messages, temperature: 0.5 })
            });

            let secondData = await secondResponse.json();
            finalContent = secondData.choices?.[0]?.message?.content;
        } else {
            finalContent = data.choices?.[0]?.message?.content;
        }

        return kambaRes(res, finalContent || "O sinal da banda tá fraco, kamba. Tenta de novo.");

    } catch (err) {
        console.error('[KAMBA ERROR]:', err.message);
        return kambaRes(res, "Me deixa só descansar um pouco. Tenta mais tarde, yha?");
    }
};

module.exports = { conversarComKamba };