// services/ai/toolRegistry.js
// Registo dinâmico de ferramentas para o Kamba

const tools = new Map();

/**
 * Regista uma nova ferramenta no sistema
 * @param {Object} config - Configuração da ferramenta
 * @param {string} config.name - Nome único da ferramenta
 * @param {string} config.description - Descrição para o LLM
 * @param {Function} config.handler - Função async que executa a ferramenta
 * @param {Object} config.parameters - Schema de parâmetros (OpenAI format)
 * @param {boolean} config.requiresAuth - Se requer autenticação
 * @param {boolean} config.cacheable - Se o resultado pode ser cacheado
 * @param {number} config.cacheTTL - Tempo de cache em ms (default: 5min)
 * @param {string} config.category - Categoria da ferramenta
 */
const register = (config) => {
  if (!config.name || !config.description || !config.handler) {
    throw new Error('Tool deve ter name, description e handler');
  }

  tools.set(config.name, {
    ...config,
    cacheable: config.cacheable || false,
    cacheTTL: config.cacheTTL || 5 * 60 * 1000,
    category: config.category || 'general'
  });

  console.log(`[TOOL REGISTRY] Ferramenta registada: ${config.name}`);
};

/**
 * Remove uma ferramenta do registo
 * @param {string} name - Nome da ferramenta
 */
const unregister = (name) => {
  tools.delete(name);
  console.log(`[TOOL REGISTRY] Ferramenta removida: ${name}`);
};

/**
 * Obtém uma ferramenta pelo nome
 * @param {string} name - Nome da ferramenta
 * @returns {Object|null} Configuração da ferramenta
 */
const get = (name) => {
  return tools.get(name) || null;
};

/**
 * Lista todas as ferramentas registadas
 * @param {string} category - Filtrar por categoria (opcional)
 * @returns {Array} Lista de ferramentas
 */
const list = (category = null) => {
  const allTools = Array.from(tools.values());
  if (category) {
    return allTools.filter(t => t.category === category);
  }
  return allTools;
};

/**
 * Gera as tool definitions no formato OpenAI
 * @returns {Array} Array de tool definitions
 */
const getToolDefinitions = () => {
  return Array.from(tools.values()).map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: "object", properties: {} }
    }
  }));
};

/**
 * Executa uma ferramenta pelo nome
 * @param {string} name - Nome da ferramenta
 * @param {Object} params - Parâmetros da ferramenta
 * @param {Object} context - Contexto de execução (usuarioId, etc)
 * @returns {Promise<any>} Resultado da ferramenta
 */
const execute = async (name, params = {}, context = {}) => {
  const tool = tools.get(name);
  
  if (!tool) {
    console.warn(`[TOOL REGISTRY] Ferramenta não encontrada: ${name}`);
    return { erro: `Ferramenta '${name}' não disponível`, disponivel: false };
  }

  try {
    const resultado = await tool.handler(params, context);
    return resultado || { erro: 'Sem dados disponíveis', disponivel: true };
  } catch (err) {
    console.error(`[TOOL REGISTRY] Erro na ferramenta ${name}:`, err.message);
    return { erro: `Erro ao executar ferramenta: ${err.message}`, disponivel: true };
  }
};

/**
 * Executa múltiplas ferramentas em paralelo
 * @param {Array} toolCalls - Array de { name, params }
 * @param {Object} context - Contexto de execução
 * @returns {Promise<Array>} Resultados
 */
const executeMultiple = async (toolCalls, context = {}) => {
  const resultados = await Promise.allSettled(
    toolCalls.map(tc => execute(tc.name, tc.params, context))
  );

  return resultados.map((result, idx) => ({
    name: toolCalls[idx].name,
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : { erro: result.reason?.message || 'Erro desconhecido' }
  }));
};

/**
 * Limpa todas as ferramentas registadas
 */
const clear = () => {
  tools.clear();
  console.log('[TOOL REGISTRY] Todas as ferramentas removidas');
};

module.exports = {
  register,
  unregister,
  get,
  list,
  getToolDefinitions,
  execute,
  executeMultiple,
  clear
};
