// src/utils/responseFormatter.js
const { HTTP_STATUS } = require('../config/constants');

/**
 * ==========================================
 * FORMATA RESPOSTA DE SUCESSO PADRÃO
 * ==========================================
 */
const successResponse = (
  res,
  data,
  message = 'Operação realizada com sucesso',
  statusCode = HTTP_STATUS.OK,
  meta = null
) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  // Adicionar metadados se fornecidos
  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE SUCESSO SEM DADOS
 * ==========================================
 */
const successNoContent = (res, message = 'Operação realizada com sucesso') => {
  return res.status(HTTP_STATUS.NO_CONTENT).json({
    success: true,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE CRIAÇÃO (201)
 * ==========================================
 */
const createdResponse = (
  res,
  data,
  message = 'Recurso criado com sucesso',
  location = null
) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  // Adicionar header Location se fornecido
  if (location) {
    res.setHeader('Location', location);
  }

  return res.status(HTTP_STATUS.CREATED).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE ERRO
 * ==========================================
 */
const errorResponse = (
  res,
  message = 'Erro ao processar requisição',
  statusCode = HTTP_STATUS.INTERNAL_ERROR,
  errors = null
) => {
  const response = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Adicionar erros de validação se existirem
  if (errors) {
    response.error.details = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA PAGINADA
 * ==========================================
 */
const paginatedResponse = (
  res,
  data,
  page,
  limit,
  total,
  message = 'Dados retornados com sucesso'
) => {
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const itemsPerPage = parseInt(limit);

  const response = {
    success: true,
    message,
    data,
    pagination: {
      currentPage,
      totalPages,
      totalItems: total,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null
    },
    timestamp: new Date().toISOString()
  };

  // Adicionar links de navegação
  const baseUrl = `${res.req.protocol}://${res.req.get('host')}${res.req.baseUrl}${res.req.path}`;
  
  response.pagination.links = {
    self: `${baseUrl}?page=${currentPage}&limit=${itemsPerPage}`,
    first: `${baseUrl}?page=1&limit=${itemsPerPage}`,
    last: `${baseUrl}?page=${totalPages}&limit=${itemsPerPage}`
  };

  if (response.pagination.hasNextPage) {
    response.pagination.links.next = `${baseUrl}?page=${currentPage + 1}&limit=${itemsPerPage}`;
  }

  if (response.pagination.hasPrevPage) {
    response.pagination.links.prev = `${baseUrl}?page=${currentPage - 1}&limit=${itemsPerPage}`;
  }

  return res.status(HTTP_STATUS.OK).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE LISTA VAZIA
 * ==========================================
 */
const emptyResponse = (
  res,
  message = 'Nenhum dado encontrado, kamba!',
  meta = null
) => {
  const response = {
    success: true,
    message,
    data: [],
    count: 0,
    timestamp: new Date().toISOString()
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(HTTP_STATUS.OK).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA COM AGREGAÇÃO DE DADOS
 * ==========================================
 */
const aggregateResponse = (
  res,
  data,
  summary,
  message = 'Dados agregados com sucesso'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data,
    summary,
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE VALIDAÇÃO
 * ==========================================
 */
const validationErrorResponse = (res, errors) => {
  const formattedErrors = errors.map(err => ({
    field: err.param || err.field,
    message: err.msg || err.message,
    value: err.value
  }));

  return res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    error: {
      message: 'Erro de validação nos dados fornecidos',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details: formattedErrors,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE AUTENTICAÇÃO
 * ==========================================
 */
const authResponse = (
  res,
  token,
  user,
  message = 'Autenticação realizada com sucesso'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data: {
      token,
      user
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE ESTATÍSTICAS/INSIGHTS
 * ==========================================
 */
const insightsResponse = (
  res,
  insights,
  periodo,
  message = 'Insights calculados com sucesso'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data: insights,
    meta: {
      periodo,
      calculadoEm: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DO KAMBA (ASSISTENTE)
 * ==========================================
 */
const kambaResponse = (
  res,
  resposta,
  contexto = null,
  sugestoes = []
) => {
  const response = {
    success: true,
    message: 'Resposta do Kamba',
    data: {
      resposta,
      sugestoes
    },
    timestamp: new Date().toISOString()
  };

  if (contexto) {
    response.data.contexto = contexto;
  }

  return res.status(HTTP_STATUS.OK).json(response);
};

/**
 * ==========================================
 * FORMATA RESPOSTA COM ALERTA
 * ==========================================
 */
const warningResponse = (
  res,
  data,
  warning,
  message = 'Operação concluída com avisos'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data,
    warning: {
      message: warning,
      type: 'warning'
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE BATCH/LOTE
 * ==========================================
 */
const batchResponse = (
  res,
  successCount,
  failureCount,
  results,
  message = 'Operação em lote concluída'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data: {
      total: successCount + failureCount,
      successful: successCount,
      failed: failureCount,
      results
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * FORMATA RESPOSTA DE EXPORTAÇÃO
 * ==========================================
 */
const exportResponse = (
  res,
  data,
  formato,
  nomeArquivo,
  message = 'Dados exportados com sucesso'
) => {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message,
    data,
    export: {
      formato,
      nomeArquivo,
      tamanho: JSON.stringify(data).length,
      geradoEm: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * ==========================================
 * WRAPPER GENÉRICO PARA RESPOSTAS
 * ==========================================
 */
const sendResponse = (res, statusCode, success, message, data = null, extra = {}) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...extra
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * ==========================================
 * HELPER: FORMATA VALORES MONETÁRIOS
 * ==========================================
 */
const formatCurrency = (value) => {
  return {
    raw: value,
    formatted: `${value.toLocaleString('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} Kz`
  };
};

/**
 * ==========================================
 * HELPER: ADICIONA MENSAGEM AMIGÁVEL
 * ==========================================
 */
const addFriendlyMessage = (response, message) => {
  response.mensagemAmigavel = message;
  return response;
};

module.exports = {
  // Respostas de sucesso
  successResponse,
  successNoContent,
  createdResponse,
  
  // Respostas de erro
  errorResponse,
  validationErrorResponse,
  
  // Respostas especializadas
  paginatedResponse,
  emptyResponse,
  aggregateResponse,
  authResponse,
  insightsResponse,
  kambaResponse,
  warningResponse,
  batchResponse,
  exportResponse,
  
  // Wrapper genérico
  sendResponse,
  
  // Helpers
  formatCurrency,
  addFriendlyMessage
};