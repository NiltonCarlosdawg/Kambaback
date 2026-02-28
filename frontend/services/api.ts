import axios, { AxiosError } from 'axios';

// Usar variável de ambiente ou fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos timeout
});

// Request Interceptor: Add Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
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
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        
        if (data.success && data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login'; // Melhor que hash para SPA
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