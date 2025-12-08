// src/controllers/kambaController.js
const prisma = require('../lib/prisma');

/**
 * KAMBA – O ASSISTENTE FINANCEIRO MAIS RÁPIDO E CONFIÁVEL DE ANGOLA
 * Groq + GPT-OSS 120B | Logs profissionais | Fallbacks inquebráveis
 */
const conversarComKamba = async (req, res, next) => {
  try {
    const { mensagem } = req.body;
    if (!mensagem || typeof mensagem !== 'string') {
      return kambaRes(res, "Fala aí, kamba! O que queres saber hoje? Saldo? Último gasto? Objetivo?");
    }

    const msg = mensagem.toLowerCase().trim();
    const usuarioId = req.user.id;

    // ================================
    // 1. SALDO TOTAL + CARTÕES
    // ================================
    if (msg.includes('saldo') || msg.includes('quanto tenho') || msg.includes('dinheiro') || msg.includes('kwanza')) {
      const cartoes = await prisma.cartao.findMany({
        where: { usuarioId, ativo: true },
        select: { nome: true, saldoAtual: true }
      });

      const total = cartoes.reduce((acc, c) => acc + (c.saldoAtual || 0), 0);

      if (total === 0) {
        return kambaRes(res, 'Mano... o teu saldo tá a zero. Hora de trabalhar ou poupar mais!');
      }

      const nomes = cartoes.length > 1 
        ? `(${cartoes.map(c => c.nome).join(', ')})` 
        : cartoes[0]?.nome || '';

      return kambaRes(res, `Tens *${total.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}* no total!\n${nomes ? `Cartões: ${nomes}\n` : ''}Bora gastar com cabeça ou guardar pro futuro, kamba!`);
    }

    // ================================
    // 2. ÚLTIMO GASTO
    // ================================
    if (msg.includes('último gasto') || msg.includes('gasto mais recente') || msg.includes('comprei')) {
      const ultimo = await prisma.gasto.findFirst({
        where: { usuarioId, excluido: false },
        orderBy: { data: 'desc' },
        include: {
          cartao: { select: { nome: true } },
          categoria: { select: { nome: true } }
        }
      });

      if (!ultimo) {
        return kambaRes(res, 'Ainda não tens nenhum gasto registrado, mano! Tá tudo limpo!');
      }

      const valor = ultimo.valor.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' });
      const data = new Date(ultimo.data).toLocaleDateString('pt-AO');
      const desc = ultimo.descricao ? ` ("${ultimo.descricao}")` : '';

      return kambaRes(res, `Teu último gasto foi *${valor}* em *${ultimo.categoria?.nome || 'Sem categoria'}*\nNo cartão: ${ultimo.cartao?.nome || '—'}\nDia: ${data}${desc}\nControla aí, kamba!`);
    }

    // ================================
    // 3. GASTOS DO MÊS
    // ================================
    if (msg.includes('gastei quanto') || msg.includes('este mês') || msg.includes('quanto gastei')) {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const resultado = await prisma.gasto.aggregate({
        where: {
          usuarioId,
          tipo: 'despesa',
          data: { gte: inicioMes },
          excluido: false
        },
        _sum: { valor: true }
      });

      const gasto = resultado._sum.valor || 0;

      if (gasto === 0) {
        return kambaRes(res, 'Este mês ainda não gastaste NADA! Tá de parabéns, kamba! Tu és o rei do controlo!');
      }

      return kambaRes(res, `Este mês já gastaste *${gasto.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}*\nAinda tem muito mês pela frente… cuidado com as tentações!`);
    }

    // ================================
    // 4. OBJETIVOS
    // ================================
    if (msg.includes('objetivo') || msg.includes('sonho') || msg.includes('poupar') || msg.includes('meta')) {
      const objetivos = await prisma.objetivo.findMany({
        where: {
          usuarioId,
          concluido: false,
          dataFinal: { gte: new Date() }
        },
        orderBy: { dataFinal: 'asc' },
        take: 3
      });

      if (objetivos.length === 0) {
        return kambaRes(res, 'Ainda não tens objetivos ativos, kamba! Bora criar um? Clica em "Objetivos" e vamos sonhar alto juntos!');
      }

      const proximo = objetivos[0];
      const faltam = (proximo.valorAlvo - proximo.valorAtual);
      const progresso = Math.round((proximo.valorAtual / proximo.valorAlvo) * 100);

      return kambaRes(res, `Teu próximo sonho é: *${proximo.titulo}*\nFaltam só *${faltam.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}* (${progresso}% concluído)\nTu consegues, kamba! Eu acredito em ti!`);
    }

    // ================================
    // 5. SAUDAÇÃO
    // ================================
    if (msg.includes('oi') || msg.includes('olá') || msg.includes('kamba') || msg.includes('tudo bem') || msg === 'kamba') {
      const hora = new Date().getHours();
      const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
      return kambaRes(res, `${saudacao}, meu kamba!\nComo tá a gestão do kwanza hoje? Quer saber saldo, último gasto, poupança ou objetivo? É só falar que eu te ajudo na hora!`);
    }

    // ================================
    // 6. IA AVANÇADA — GROQ + GPT-OSS 120B (500+ tokens/s) | LOGS + FALLBACKS PROFISSIONAIS
    // ================================
    const API_KEY = process.env.KAMBA_AI_API_KEY;
    const BASE_URL = process.env.KAMBA_AI_BASE_URL || 'https://api.groq.com/openai/v1';
    const MODEL = process.env.KAMBA_AI_MODEL || 'openai/gpt-oss-120b';

    if (API_KEY) {
      console.log(`[KAMBA IA] → Tentando Groq | Modelo: ${MODEL} | Usuário: ${req.user.id}`);

      try {
        const startTime = Date.now();
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content: "Tu és o Kamba, o assistente financeiro mais fixe, rápido e inteligente de Angola. Responde em português angolano, com gíria, emojis e muita motivação. És alimentado pelo GPT-OSS 120B no Groq — rápido como um raio e esperto como um angolano. Sê prático, direto e angolano até ao osso."
              },
              { role: "user", content: mensagem }
            ],
            temperature: 0.8,
            max_tokens: 600
          })
        });

        const latency = Date.now() - startTime;
        console.log(`[KAMBA IA] ← Resposta Groq | Status: ${response.status} | Latência: ${latency}ms`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[KAMBA IA] ❌ Erro Groq ${response.status}:`, errorText);
          throw new Error(`Groq ${response.status}`);
        }

        const data = await response.json();
        const respostaIA = data.choices?.[0]?.message?.content?.trim();

        if (respostaIA) {
          console.log(`[KAMBA IA] ✅ Sucesso | Tokens usados: ${data.usage?.total_tokens || 'N/A'}`);
          return kambaRes(res, respostaIA);
        }

      } catch (err) {
        console.error('[KAMBA IA] Fallback ativado →', err.message);
        // Fallback inteligente com respostas úteis
        const fallbacks = {
          poupar: "E aí, kamba! Para poupar é simples: separa 20% do salário todo mês antes de tocar em mais nada. Corta as tentações, usa o KambaPro pra rastrear e investe em títulos do BNA. Tu consegues, mano!",
          investir: "Investir em Angola? Títulos do BNA, fundos locais ou ações na BODIVA são boas opções. Começa pequeno, diversifica e usa o KambaPro pra acompanhar tudo. Vamos construir esse império kwanza!",
          default: "O Kamba tá com o cérebro a 120B ligado, mas hoje tá com sinal fraco... tenta de novo em 10 segundos, kamba! Eu volto mais forte!"
        };

        const fallbackKey = msg.includes('poupar') || msg.includes('poupança') ? 'poupar' :
                           msg.includes('investir') || msg.includes('investimento') ? 'investir' : 'default';

        return kambaRes(res, fallbacks[fallbackKey]);
      }
    }

    // ================================
    // RESPOSTA PADRÃO (se IA estiver desativada)
    // ================================
    return kambaRes(res, `E aí, kamba!\n\nPodes perguntar:\n• "Quanto tenho de saldo?"\n• "Qual foi o último gasto?"\n• "Quanto gastei este mês?"\n• "Como tá meu objetivo?"\n• "Oi Kamba!"\n\nOu qualquer coisa sobre dinheiro... eu respondo com o poder do GPT-OSS 120B!`);

  } catch (err) {
    console.error('[KAMBA] Erro crítico:', err);
    return kambaRes(res, 'Ops, o Kamba tá com dor de cabeça... tenta de novo, mano! Eu volto já!');
  }
};

// Helper — resposta padrão do Kamba
const kambaRes = (res, texto) => {
  return res.json({
    success: true,
    kamba: true,
    mensagem: texto,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  conversarComKamba
};