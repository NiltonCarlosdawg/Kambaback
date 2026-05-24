const OpenAI = require("openai");

const API_KEY = process.env.KAMBA_AI_API_KEY;
const BASE_URL =
  process.env.KAMBA_AI_BASE_URL || "https://api.groq.com/openai/v1";
const MODEL = process.env.KAMBA_AI_MODEL || "gpt-oss-120b";
const MAX_TENTATIVAS = 4;
const TIMEOUT_MS = 25000;

let client = null;

const getClient = () => {
  if (!client) {
    if (!API_KEY) return null;
    client = new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      timeout: TIMEOUT_MS,
      maxRetries: MAX_TENTATIVAS - 1,
    });
  }
  return client;
};

const buildParams = (messages, options = {}) => {
  const { tools = null, stream = false, temperature = null } = options;
  const params = {
    model: MODEL,
    messages,
    max_tokens: 2048,
    temperature: temperature ?? (tools ? 0.5 : 0.4),
    stream,
  };

  if (tools && tools.length > 0) {
    params.tools = tools;
    params.tool_choice = "auto";
  }

  return params;
};

const handleStream = async (params, onChunk) => {
  let fullContent = "";
  const toolCallsMap = new Map();

  try {
    const stream = await getClient().chat.completions.create(params);

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta?.content) {
        fullContent += delta.content;
        if (onChunk) onChunk({ type: "chunk", content: delta.content });
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            toolCallsMap.set(tc.index, {
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function?.name || "",
                arguments: tc.function?.arguments || "",
              },
            });
          } else if (toolCallsMap.has(tc.index)) {
            const existing = toolCallsMap.get(tc.index);
            existing.function.arguments += tc.function?.arguments || "";
          }
        }
      }
    }
  } catch (err) {
    if (onChunk) onChunk({ type: "error", error: err.message });
    throw err;
  }

  const toolCalls =
    toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values()).map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }))
      : undefined;

  return {
    choices: [
      {
        message: {
          content: fullContent || null,
          tool_calls: toolCalls,
        },
        finish_reason: toolCalls ? "tool_calls" : "stop",
      },
    ],
    usage: { total_tokens: 0 },
  };
};

const chamarGroq = async (messages, comTools = false, tentativa = 1) => {
  if (comTools) {
    throw new Error("Tools devem ser passadas explicitamente no body");
  }

  const params = buildParams(messages, { tools: null });

  try {
    const response = await getClient().chat.completions.create(params);
    return {
      choices: response.choices.map((c) => ({
        message: {
          content: c.message.content || "",
          role: c.message.role,
        },
        finish_reason: c.finish_reason,
      })),
      usage: response.usage || { total_tokens: 0 },
    };
  } catch (err) {
    if (
      tentativa < MAX_TENTATIVAS &&
      !err.message?.includes("401") &&
      !err.message?.includes("Invalid API Key")
    ) {
      const espera = 500 * Math.pow(2, tentativa);
      await new Promise((r) => setTimeout(r, espera));
      return chamarGroq(messages, comTools, tentativa + 1);
    }
    throw err;
  }
};

const chamarGroqComTools = async (messages, tools, tentativa = 1) => {
  const params = buildParams(messages, { tools });

  try {
    const response = await getClient().chat.completions.create(params);
    return {
      choices: response.choices.map((c) => ({
        message: {
          content: c.message.content,
          role: c.message.role,
          tool_calls: c.message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        },
        finish_reason: c.finish_reason,
      })),
      usage: response.usage || { total_tokens: 0 },
    };
  } catch (err) {
    if (
      tentativa < MAX_TENTATIVAS &&
      !err.message?.includes("401") &&
      !err.message?.includes("Invalid API Key")
    ) {
      const espera = 500 * Math.pow(2, tentativa);
      await new Promise((r) => setTimeout(r, espera));
      return chamarGroqComTools(messages, tools, tentativa + 1);
    }
    throw err;
  }
};

const completar = async (messages, options = {}) => {
  const { tools = null, stream = false, onChunk = null } = options;
  const params = buildParams(messages, { tools, stream });

  if (stream) {
    return handleStream(params, onChunk);
  }

  const response = await getClient().chat.completions.create(params);
  return {
    choices: response.choices.map((c) => ({
      message: {
        content: c.message.content,
        role: c.message.role,
        tool_calls: c.message.tool_calls?.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      finish_reason: c.finish_reason,
    })),
    usage: response.usage || { total_tokens: 0 },
  };
};

const chamarStream = async (messages, options = {}) => {
  return completar(messages, { ...options, stream: true });
};

const isConfigured = () => {
  return !!API_KEY && !!BASE_URL;
};

const isModerationSupported = () => {
  return isConfigured() && !BASE_URL.includes("groq.com");
};

module.exports = {
  chamarGroq,
  chamarGroqComTools,
  completar,
  chamarStream,
  isConfigured,
  isModerationSupported,
  getClient,
  GROQ_MODEL: MODEL,
};
