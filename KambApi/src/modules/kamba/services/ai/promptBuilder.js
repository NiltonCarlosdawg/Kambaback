// services/ai/promptBuilder.js
// Builder de prompts com templates versionados para o Kamba

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '../../plugins/prompts');

/**
 * Carrega um template de ficheiro ou usa fallback
 * @param {string} name - Nome do template (ex: 'v1_system')
 * @returns {string} Conteúdo do template
 */
const carregarTemplate = (name) => {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
};

/**
 * Gera o system prompt principal para queries financeiras (com tools)
 * @param {Object} perfil - Dados do utilizador
 * @param {number|string} idade - Idade do utilizador
 * @param {string} contextoFinanceiro - Contexto financeiro opcional
 * @returns {string} System prompt completo
 */
const gerarSystemPrompt = (perfil, idade, contextoFinanceiro = '') => {
  const hoje = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'long' });

  // Tentar carregar template externo
  const templateExterno = carregarTemplate('v1_system');
  if (templateExterno) {
    return templateExterno
      .replace('{{NOME}}', perfil.nome || 'Utilizador')
      .replace('{{MORADA}}', perfil.morada || 'Luanda')
      .replace('{{IDADE}}', idade)
      .replace('{{RENDA}}', perfil.rendaMensalMedia ? perfil.rendaMensalMedia.toLocaleString('pt-AO') + ' AOA' : 'não informada')
      .replace('{{RISCO}}', perfil.perfilDeRisco || 'Moderado')
      .replace('{{DATA}}', hoje)
      .replace('{{CONTEXTO_FINANCEIRO}}', contextoFinanceiro || '');
  }

  // Fallback para prompt inline (manter compatibilidade)
  return `Tu és o KAMBA, o teu consultor financeiro angolano na aplicação KambaPro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DADOS DO UTILIZADOR (Contexto Primário)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nome: ${perfil.nome || 'Utilizador'} | Local: ${perfil.morada || 'Luanda'} | Idade: ${idade}
- Renda: ${perfil.rendaMensalMedia ? perfil.rendaMensalMedia.toLocaleString('pt-AO') + ' AOA' : 'não informada'}
- Perfil: ${perfil.perfilDeRisco || 'Moderado'} | Data: ${hoje}

${contextoFinanceiro ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DADOS FINANCEIROS REAIS (BD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${contextoFinanceiro}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FILOSOFIA DE RESPOSTA (Estilo Gemini CLI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **Foco na Intenção**: Identifica o que o utilizador realmente precisa. Sê directo para perguntas simples e detalhado para pedidos complexos ou pedagógicos.
2. **Sem Hallucinação de Tutoriais**: NUNCA inventes passos manuais para acções que o sistema pode fazer (ex: adicionar cartões, registar gastos). Se não houver ferramenta para a acção, sê honesto.
3. **Sinal-Ruído Elevado**: Prioriza informação útil e técnica sobre preâmbulos ou conversas fiadas. Evita "knowledge dumping" de factos não solicitados.
4. **Tom Profissional-Casual**: Mantém a identidade angolana ("kamba", "mano", "yha") mas com a clareza e precisão de um especialista financeiro.
5. **Contextualização Inteligente**: Usa os dados financeiros reais (BD) e o contexto de Angola apenas para fundamentar as tuas respostas, sem repetir o que o utilizador já sabe.
6. **Estrutura Limpa**: Usa listas se ajudar na clareza, mas prefere parágrafos fluidos e bem articulados. Não há limite rígido de frases, mas a brevidade estratégica é a tua regra de ouro.

7. **Ação Próxima**: Termina com uma sugestão prática ou pergunta de seguimento que avance a resolução do problema do utilizador.`;
};

/**
 * Gera prompt minimal para conversas casuais (sem tools)
 * @param {Object} perfil - Dados do utilizador
 * @returns {string} Prompt minimal
 */
const gerarPromptMinimal = (perfil) => {
  return `És o Kamba, o bró financeiro angolano. 
Nome: ${perfil?.nome || 'kamba'}.
REGRA: Responde de forma casual e super curta (máx 15 palavras). NÃO fales de finanças se não te perguntarem.`;
};

/**
 * Gera prompt para sumarização de conversas
 * @param {Array} mensagens - Array de mensagens para sumarizar
 * @returns {string} Prompt de sumarização
 */
const gerarPromptSumarizacao = (mensagens) => {
  const texto = mensagens.map(m => `${m.role}: ${m.content}`).join('\n');
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
  carregarTemplate
};
