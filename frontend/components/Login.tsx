// src/components/Login.tsx
import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { AuthResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onRegisterClick: () => void;
}

// ─── Shared inline components ───────────────────────────────────────────────
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, ...props }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <div>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>
          {label}
        </label>
      )}
      <input
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
        className="w-full h-[52px] rounded-xl px-4 text-sm outline-none transition-all"
        style={{
          backgroundColor: focused ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text-primary)',
          boxShadow: focused ? '0 0 0 3px var(--accent-10)' : 'none',
          ...(props.style || {}),
        }}
      />
    </div>
  );
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onRegisterClick }) => {
  const { prefs } = useTheme();
  const [email,        setEmail]        = useState('');
  const [senha,        setSenha]        = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, senha });
      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao entrar. Verifica os dados.');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-4 font-sans antialiased animate-in fade-in duration-500"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <svg fill="black" viewBox="0 0 48 48" className="w-4 h-4"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>KambaPro</span>
        </div>
        <a
          href="#"
          className="hidden md:block text-xs font-medium transition-colors"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; }}
        >
          Help Center
        </a>
      </header>

      {/* Card */}
      <div className="w-full max-w-[400px] animate-in slide-in-from-bottom-4 fade-in duration-500">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 ring-1 ring-inset"
            style={{ backgroundColor: 'var(--accent-10)', ringColor: 'var(--accent-20)' }}>
            <ShieldCheck size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            Bem-vindo de volta
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Insere os teus dados para entrar na conta
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm border"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Endereço de email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />

          {/* Password with toggle */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>
              Palavra-passe
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="A tua palavra-passe"
                style={{ paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <a
              href="#"
              className="text-[11px] font-semibold transition-colors"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; }}
            >
              Esqueceu a palavra-passe?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-xl font-medium text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            {loading ? 'A entrar…' : 'Entrar na conta'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>ou</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>
          Ainda não tens conta?{' '}
          <button
            onClick={onRegisterClick}
            className="font-semibold transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-primary)'; }}
          >
            Criar conta grátis
          </button>
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 text-center w-full">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-faint)', opacity: 0.4 }}>
          © 2025 KambaPro International
        </p>
      </footer>

      {/* Subtle blobs */}
      <div className="absolute top-1/3 -left-32 w-72 h-72 rounded-full blur-[120px] pointer-events-none"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.06 }} />
      <div className="absolute bottom-1/3 -right-32 w-96 h-96 rounded-full blur-[140px] pointer-events-none"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.05 }} />
    </div>
  );
};

export default Login;