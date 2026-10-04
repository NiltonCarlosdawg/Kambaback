// frontend/utils/apiError.ts — F-025
// A API devolve erros como { mensagem } (ou { mensagemAmigavel }, { error: { message } }
// nalgumas rotas) — ler `err.message`/`data.message` em successors dava
// "Erro: undefined" ou texto interno do axios. Centraliza a extração com
// fallback garantido: nunca devolve vazio.

type ErroApi = {
  response?: {
    data?: {
      mensagemAmigavel?: string;
      mensagem?: string;
      message?: string;
      error?: { message?: string };
    };
  };
};

export const getApiError = (err: unknown, fallback: string): string => {
  const data = (err as ErroApi | null | undefined)?.response?.data;
  const candidatos = [
    data?.mensagemAmigavel,
    data?.mensagem,
    data?.error?.message,
    data?.message,
  ];
  return (
    candidatos.find((t) => typeof t === 'string' && t.trim().length > 0) ||
    fallback
  );
};
