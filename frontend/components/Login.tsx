// src/components/Login.tsx
import React, { useState } from 'react';
import api from '../services/api';
import { AuthResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onRegisterClick: () => void;
}

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

  const inputClass: React.CSSProperties = {
    width: '100%', height: 56, backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    padding: '0 20px', color: '#fff', outline: 'none',
    fontSize: 15, transition: 'border-color 200ms',
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-4 font-sans antialiased"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6" style={{ color: 'var(--accent)' }}>
            <svg fill="currentColor" viewBox="0 0 48 48"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>KambaPro</span>
        </div>
        <a className="hidden md:block text-sm font-medium transition-colors" href="#"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-faint)'; }}>
          Help Center
        </a>
      </header>

      {/* Main card */}
      <div className="w-full max-w-[420px] flex flex-col items-center space-y-10">
        {/* Branding */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            Kamba<span style={{ color: 'var(--accent)' }}>Pro</span>
          </h1>
          <p className="text-sm font-light tracking-wide" style={{ color: 'var(--text-faint)' }}>
            Bem vindo de volta. Por favor, insira os seus dados.
          </p>
        </div>

        {error && (
          <div className="w-full p-4 rounded-xl text-sm text-center border border-red-500/30 bg-red-900/20 text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email */}
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Endereço de email" style={inputClass}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />

          {/* Password */}
          <div className="relative flex items-center">
            <input type={showPassword ? 'text' : 'password'} required
              value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="Palavra-passe"
              style={{ ...inputStyle(), paddingRight: 52 }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
              onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 transition-colors"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showPassword ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
            </button>
          </div>

          {/* Forgot */}
          <div className="flex justify-end px-1">
            <a href="#" className="text-xs font-medium uppercase tracking-widest transition-colors"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-faint)'; }}>
              Esqueceu a sua palavra-passe?
            </a>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button type="submit" disabled={loading}
              className="w-full h-14 rounded-full font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent)',
                color:           'var(--accent-text)',
                boxShadow:       '0 0 20px var(--accent-20)',
              }}>
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Ainda não tens uma conta?{' '}
            <button onClick={onRegisterClick}
              className="font-semibold transition-colors underline underline-offset-4"
              style={{ color: 'var(--text-primary)', textDecorationColor: 'var(--accent-20)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}>
              Criar Conta
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-10 text-center w-full">
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-30" style={{ color: 'var(--text-faint)' }}>
          © 2025 KAMBAPRO INTERNATIONAL. ALL RIGHTS RESERVED.
        </p>
      </footer>

      {/* Decorative blobs — accent coloured */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-10"
        style={{ backgroundColor: 'var(--accent)' }} />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-[120px] pointer-events-none opacity-10"
        style={{ backgroundColor: 'var(--accent)' }} />
    </div>
  );
};

// Helper outside component to keep JSX clean
function inputStyle(): React.CSSProperties {
  return {
    width: '100%', height: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: '0 20px',
    color: '#fff', outline: 'none', fontSize: 15,
    transition: 'border-color 200ms',
  };
}

export default Login;