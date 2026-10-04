import axios, { AxiosError } from 'axios';

// Usar variável de ambiente ou fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  // F-019: sem withCredentials o navegador IGNORA o Set-Cookie do refresh
  // nas respostas cross-origin (localhost:3000 → :3001 / Vercel → Render)
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos timeout
});

// ── F-019: access token vive SÓ em memória ──────────────────────────────────
// O refresh token está num cookie httpOnly definido pelo backend (nunca toca
// no JS); após um reload a sessão renova-se por esse cookie. Um XSS lê no
// máximo o access token de curta duração em memória — não consegue renovar.
let accessTokenEmMemoria: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessTokenEmMemoria = token;
  if (!token) {
    // limpa chaves legadas de versões anteriores que usavam localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

export const getAccessToken = () => accessTokenEmMemoria;

/** Tenta renovar a sessão usando o cookie httpOnly (withCredentials). */
export const refreshSession = async (): Promise<string | null> => {
  try {
    const { data } = await axios.post(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    if (data.success && data.accessToken) {
      accessTokenEmMemoria = data.accessToken;
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
};

// Request Interceptor: Add Access Token
api.interceptors.request.use(
  (config) => {
    const token = accessTokenEmMemoria;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Tratamento específico por status
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // F-019: renova pelo cookie httpOnly (sem refresh token no JS)
        const novoAccessToken = await refreshSession();
        if (novoAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${novoAccessToken}`;
          return api(originalRequest);
        }
        throw new Error('Sessão expirada');
      } catch {
        // Refresh failed - logout user
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }

    // Tratamento 403 (Forbidden) - usuário bloqueado/desativado
    if (error.response?.status === 403) {
      const errorData = (error.response.data as any)?.error;
      if (errorData?.message?.includes('desativada')) {
        alert('Conta desativada. Contacta o suporte.');
        localStorage.clear();
        window.location.href = '/login';
      } else if (errorData?.message?.includes('bloqueada')) {
        alert('Conta bloqueada temporariamente por segurança.');
      }
    }

    // Tratamento 429 (Too Many Requests)
    if (error.response?.status === 429) {
      const msg = (error.response.data as any)?.error?.message || 'Muitas requisições. Aguarde.';
      alert(msg);
    }

    return Promise.reject(error);
  }
);

export default api;