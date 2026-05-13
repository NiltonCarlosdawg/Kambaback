// src/components/Login.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

import api from '../services/api';
import { AuthResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onRegisterClick: () => void;
}

// ─── Animated Background Component ───────────────────────────────────────────
const AnimatedBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[100px]"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.15 }}
        animate={{
          y: [0, -30, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute top-1/3 -left-32 w-80 h-80 rounded-full blur-[80px]"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.1 }}
        animate={{
          y: [0, 20, 0],
          rotate: [0, -5, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute -bottom-32 right-1/4 w-72 h-72 rounded-full blur-[90px]"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.08 }}
        animate={{
          y: [0, -15, 0],
          rotate: [0, 3, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 20% 50%, var(--accent-10) 0%, transparent 50%),
                       radial-gradient(ellipse at 80% 20%, var(--accent-10) 0%, transparent 50%),
                       radial-gradient(ellipse at 50% 80%, var(--accent-10) 0%, transparent 50%)`
        }}
      />
    </div>
  );
};

// ─── Shared inline components ───────────────────────────────────────────────
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { 
  label?: string; 
  icon?: React.ReactNode;
  error?: boolean;
}> = ({ label, icon, error, ...props }) => {
  const [focused, setFocused] = React.useState(false);
  
  return (
    <motion.div 
      className="group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors" 
          style={{ color: focused ? 'var(--accent)' : 'var(--text-faint)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <motion.div 
            className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
            style={{ color: focused ? 'var(--accent)' : 'var(--text-faint)' }}
            animate={{ scale: focused ? 1.1 : 1 }}
          >
            {icon}
          </motion.div>
        )}
        <motion.input
          {...props}
          onFocus={e => { setFocused(true); props.onFocus?.(e); }}
          onBlur={e => { setFocused(false); props.onBlur?.(e); }}
          className={`w-full h-[52px] rounded-xl px-4 text-sm outline-none transition-all duration-300
            ${icon ? 'pl-12' : ''}
            ${error ? 'border-red-500' : ''}`}
          style={{
            backgroundColor: focused ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: `2px solid ${focused ? 'var(--accent)' : error ? '#ef4444' : 'var(--border)'}`,
            color: 'var(--text-primary)',
            boxShadow: focused ? `0 0 0 4px var(--accent-10)` : 'none',
            ...(props.style || {}),
          }}
          animate={focused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.15 }}
        />
      </div>
    </motion.div>
  );
};

// ─── Social Login Button Component ───────────────────────────────────────────
const SocialButton: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => {
  
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-3 w-full h-[48px] rounded-xl border-2"
      style={{
        backgroundColor: 'transparent',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      whileHover={{ 
        scale: 1.02, 
        y: -2,
        borderColor: 'var(--accent)',
        backgroundColor: 'var(--bg-elevated)',
        boxShadow: '0 8px 25px -5px var(--accent-20)',
        transition: springBouncy,
      }}
      whileTap={{ scale: 0.98 }}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
};

// ─── Feature List Component ──────────────────────────────────────────────────
const FeatureItem: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: 'var(--accent-10)' }}>
      {icon}
    </div>
    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
  </div>
);

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onRegisterClick }) => {
  const { prefs } = useTheme();
  const [email,        setEmail]        = useState('');
  const [senha,        setSenha]        = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gisReady, setGisReady] = useState(Boolean(window.google?.accounts?.oauth2));
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const loginComGoogle = () => {
    console.log('[GOOGLE] Iniciando login...');
    if (!GOOGLE_CLIENT_ID) {
      setError('Google OAuth não configurado. Configura VITE_GOOGLE_CLIENT_ID no .env');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setError('Biblioteca Google ainda a carregar. Tenta novamente em alguns segundos.');
      return;
    }
    setError('');

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid profile email',
      callback: async (response) => {
        if (response.error) {
          console.error('[GOOGLE] Erro:', response.error);
          setError('Login com Google cancelado.');
          return;
        }
        console.log('[GOOGLE] Token obtido');
        setLoading(true);
        try {
          const { data } = await api.post<AuthResponse>('/auth/google', {
            access_token: response.access_token
          });
          if (data.success) {
            localStorage.setItem('accessToken', data.accessToken);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            const authUser = data.user ?? data.usuario;
            if (!authUser) {
              setError('Resposta de autenticação inválida.');
              return;
            }
            onLoginSuccess(authUser);
          }
        } catch (err: any) {
          setError(err.response?.data?.mensagem || 'Erro ao entrar com Google.');
        } finally {
          setLoading(false);
        }
      },
      error_callback: (err) => {
        console.error('[GOOGLE] Erro:', err);
        setError('Erro no login com Google.');
      },
    });
    client.requestAccessToken();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const markReady = () => setGisReady(true);
    const markError = () => setGisReady(false);

    window.addEventListener('google-gis-ready', markReady);
    window.addEventListener('google-gis-error', markError);

    if (window.google?.accounts?.oauth2) {
      setGisReady(true);
    }

    return () => {
      window.removeEventListener('google-gis-ready', markReady);
      window.removeEventListener('google-gis-error', markError);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError(''); 
    setLoading(true);
    
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, senha });
      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        const authUser = data.user ?? data.usuario;
        if (!authUser) {
          setError('Resposta de autenticação inválida.');
          return;
        }
        onLoginSuccess(authUser);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao entrar. Verifica os dados.');
    } finally { 
      setLoading(false); 
    }
  };

  // Google SVG Icon
  const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M19.8055 10.2275C19.8055 9.51746 19.7444 8.83496 19.6305 8.17496H10.2V12.0525H15.6016C15.3694 13.2975 14.655 14.3575 13.5983 15.0625V17.5625H16.8227C18.7172 15.8175 19.8055 13.2525 19.8055 10.2275Z" fill="#4285F4"/>
      <path d="M10.2 20C12.9 20 15.1711 19.1025 16.8227 17.5625L13.5983 15.0625C12.6961 15.6675 11.5438 16.0225 10.2 16.0225C7.59442 16.0225 5.38275 14.2625 4.58886 11.9H1.26331V14.4825C2.90609 17.745 6.29164 20 10.2 20Z" fill="#34A853"/>
      <path d="M4.58886 11.9C4.38886 11.295 4.27498 10.6525 4.27498 10C4.27498 9.3475 4.38886 8.705 4.58886 8.1V5.5175H1.26331C0.596644 6.8425 0.2 8.3775 0.2 10C0.2 11.6225 0.596644 13.1575 1.26331 14.4825L4.58886 11.9Z" fill="#FBBC05"/>
      <path d="M10.2 3.9775C11.6683 3.9775 12.9838 4.4825 14.0183 5.4725L16.8949 2.59C15.1672 0.9875 12.8961 0 10.2 0C6.29164 0 2.90609 2.255 1.26331 5.5175L4.58886 8.1C5.38275 5.7375 7.59442 3.9775 10.2 3.9775Z" fill="#EA4335"/>
    </svg>
  );

  // Apple SVG Icon
  const AppleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M15.1667 11.1333C15.1833 13.1167 16.8833 13.8333 16.95 13.8667C16.9 14.0333 16.65 14.8833 16.1667 15.5833C15.7167 16.25 14.8833 16.9333 14.0167 16.9C13.1667 16.8667 12.9 16.35 11.8833 16.35C10.85 16.35 10.5667 16.85 9.78334 16.8833C8.95 16.9167 8.01667 16.2 7.38334 15.2833C6.1 13.4167 5.13334 10.0167 6.43334 7.76667C7.08334 6.65 8.23334 5.93333 9.48334 5.91667C10.3167 5.9 11.1 6.5 11.6167 6.5C12.1333 6.5 13.15 5.75 14.2167 5.63333C14.6667 5.58333 16.1333 5.71667 17.0667 7.08333C17.0667 7.08333 15.3833 8.01667 15.1667 11.1333Z"/>
      <path d="M12.6333 4.56667C13.2833 3.78333 13.7167 2.7 13.6 1.63333C12.6667 1.66667 11.5167 2.26667 10.8333 3.06667C10.2167 3.78333 9.68334 4.88333 9.83334 5.93333C10.9 6.01667 12 5.38333 12.6333 4.56667Z"/>
    </svg>
  );

  return (
    <div
      className={`relative flex min-h-screen w-full overflow-x-hidden font-sans antialiased transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>

      <AnimatedBackground />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 md:px-10 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" 
            style={{ backgroundColor: 'var(--accent)' }}>
            <svg fill="white" viewBox="0 0 48 48" className="w-4.5 h-4.5"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>KambaPro</span>
        </div>
        <a
          href="#"
          className="hidden md:flex items-center gap-2 text-xs font-medium transition-all duration-300 px-4 py-2 rounded-lg"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { 
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.backgroundColor = 'var(--accent-10)';
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.color = 'var(--text-faint)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>Help Center</span>
        </a>
      </header>

      {/* Main Content - Split Layout */}
      <div className="flex w-full min-h-screen">
        {/* Left Side - Branding (Hidden on mobile) */}
        <div className="hidden lg:flex w-1/2 relative items-center justify-center p-16 overflow-hidden">
          <div className="absolute inset-0" 
            style={{
              background: `linear-gradient(135deg, var(--accent-10) 0%, transparent 50%, var(--accent-5) 100%)`
            }} 
          />
          
          <div className="relative z-10 max-w-lg animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6 shadow-2xl"
                style={{ 
                  backgroundColor: 'var(--accent)',
                  boxShadow: '0 20px 60px -15px var(--accent-40)'
                }}>
                <svg fill="black" viewBox="0 0 48 48" className="w-12 h-12"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
              </div>
              <h1 className="text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
                Gestão financeira<br/>simplificada
              </h1>
              <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Junte-se a milhares de utilizadores que já transformaram a sua relação com o dinheiro. 
                O KambaPro é a sua plataforma tudo-em-um para controlo financeiro.
              </p>
            </div>

            <div className="space-y-4">
              <FeatureItem 
                icon={<ShieldCheck size={18} style={{ color: 'var(--accent)' }} />}
                text="Segurança de nível bancário com encriptação de ponta"
              />
              <FeatureItem 
                icon={<Mail size={18} style={{ color: 'var(--accent)' }} />}
                text="Notificações em tempo real das suas transações"
              />
              <FeatureItem 
                icon={<Lock size={18} style={{ color: 'var(--accent)' }} />}
                text="Controlo total sobre as suas metas financeiras"
              />
            </div>

            {/* Stats removed */}
          </div>

          {/* Decorative elements */}
          <div className="absolute bottom-0 left-0 right-0 h-32"
            style={{
              background: 'linear-gradient(to top, var(--bg-base) 0%, transparent 100%)'
            }}
          />
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{ backgroundColor: 'var(--accent-10)' }}>
                <ShieldCheck size={32} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>KambaPro</h2>
            </div>

            {/* Welcome Text */}
            <div className="mb-8 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-4xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                Bem-vindo de volta
              </h2>
              <p className="text-base" style={{ color: 'var(--text-faint)' }}>
                Insere os teus dados para aceder à tua conta
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl text-sm border animate-pulse"
                style={{ 
                  backgroundColor: 'rgba(239,68,68,0.08)', 
                  borderColor: 'rgba(239,68,68,0.2)', 
                  color: '#f87171' 
                }}>
                {error}
              </div>
            )}

            {/* Login Form */}
            <motion.form 
              onSubmit={handleSubmit} 
              className="space-y-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ...springSmooth }}
            >
              <Input
                label="Endereço de email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                icon={<Mail size={18} />}
              />

              {/* Password with toggle */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" 
                  style={{ color: 'var(--text-faint)' }}>
                  Palavra-passe
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••"
                    icon={<Lock size={18} />}
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all duration-200"
                    style={{ 
                      color: showPassword ? 'var(--accent)' : 'var(--text-faint)',
                      backgroundColor: showPassword ? 'var(--accent-10)' : 'transparent'
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <motion.input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-2"
                    style={{ 
                      borderColor: 'var(--border)',
                      accentColor: 'var(--accent)'
                    }}
                    whileTap={{ scale: 1.2 }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-faint)' }}>Lembrar-me</span>
                </label>
                <motion.a
                  href="#"
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-faint)' }}
                  whileHover={{ color: 'var(--accent)' }}
                >
                  Esqueceu a palavra-passe?
                </motion.a>
              </div>

              {/* Submit Button with shimmer effect */}
              <motion.button
                type="submit"
                disabled={loading}
                className="relative w-full h-[52px] rounded-xl font-semibold text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                  boxShadow: loading ? 'none' : '0 8px 30px -8px var(--accent-40)',
                }}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {!loading && (
                  <motion.div 
                    className="absolute inset-0 opacity-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    }}
                    initial={{ opacity: 0, x: '-100%' }}
                    whileHover={{ opacity: 1, x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <motion.svg 
                        className="h-5 w-5" 
                        viewBox="0 0 24 24"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </motion.svg>
                      <span>A entrar…</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar na conta</span>
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight size={18} />
                      </motion.span>
                    </>
                  )}
                </span>
              </motion.button>
            </motion.form>

            {/* Divider */}
            <motion.div 
              className="flex items-center gap-4 my-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>ou continuar com</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
            </motion.div>

            {/* Social Login */}
            <motion.div 
              className="grid grid-cols-2 gap-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, ...springSmooth }}
            >
              <SocialButton 
                icon={<GoogleIcon />} 
                label="Google" 
                disabled={!gisReady || loading}
                onClick={() => {
                  console.log('[GOOGLE] Botão clicado');
                  loginComGoogle();
                }}
              />
              <SocialButton 
                icon={<AppleIcon />} 
                label="Apple" 
              />
            </motion.div>

            {/* Sign Up Link */}
            <motion.p 
              className="text-center text-sm"
              style={{ color: 'var(--text-faint)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Ainda não tens conta?{' '}
              <motion.button
                onClick={onRegisterClick}
                className="font-semibold relative inline-block"
                style={{ color: 'var(--accent)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Criar conta grátis
              </motion.button>
            </motion.p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center w-full z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40" style={{ color: 'var(--text-faint)' }}>
          © 2025 KambaPro International
        </p>
      </footer>
    </div>
  );
};

export default Login;
