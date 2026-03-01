// src/components/Register.tsx
import React, { useState } from 'react';
import api from '../services/api';
import { AuthResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface RegisterProps {
  onRegisterSuccess: (user: any) => void;
  onBackToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onBackToLogin }) => {
  const { prefs } = useTheme();

  const [formData, setFormData] = useState({
    nome: '', email: '', telefone: '', dataNascimento: '',
    sexo: 'Masculino', morada: '', senha: '',
  });
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const getErrorMessage = (err: any) => {
    const data = err.response?.data;
    if (!data) return 'Erro de conexão ou servidor.';
    if (typeof data.error === 'string') return data.error;
    if (data.error?.mensagemAmigavel) return data.error.mensagemAmigavel;
    if (Array.isArray(data.error?.details)) return data.error.details.map((d: any) => d.mensagem || d.message).join('. ');
    if (data.error?.message) return data.error.message;
    if (data.message) return data.message;
    return 'Erro ao criar conta. Verifica os dados.';
  };

  const calculateAge = (d: string) => {
    const today = new Date(); const birth = new Date(d);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!formData.dataNascimento) { setError('Por favor, insere a data de nascimento.'); return; }
    if (calculateAge(formData.dataNascimento) < 18) { setError('Desculpa kamba, precisas de ter pelo menos 18 anos para criar conta.'); return; }
    const cleanPhone = formData.telefone.replace(/\D/g, '');
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) { setError('O telefone deve ter 9 dígitos e começar por 9 (ex: 923...). Não uses o +244.'); return; }
    if (formData.senha.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const payload = { ...formData, dataNascimento: new Date(formData.dataNascimento).toISOString(), telefone: cleanPhone };
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      if (data.success) {
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          onRegisterSuccess(data.user);
        } else { alert('Conta criada com sucesso! Por favor faça login.'); onBackToLogin(); }
      }
    } catch (err: any) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', height: 56, background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    padding: '0 20px', color: '#fff', outline: 'none', transition: 'box-shadow var(--transition-speed,200ms)',
  };
  const focusAccent = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 1px var(--accent)'; e.target.style.borderColor = 'var(--accent)'; };
  const blurAccent  = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', backgroundBlendMode: 'normal' as any };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-4 py-12 font-sans antialiased"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', transition: 'background-color var(--transition-speed,200ms)' }}>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6" style={{ color: 'var(--accent)' }}>
            <svg fill="currentColor" viewBox="0 0 48 48"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>KambaPro</span>
        </div>
        <a className="hidden md:block text-sm font-medium transition-colors" href="#"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}>
          Centro de Ajuda
        </a>
      </header>

      <div className="w-full max-w-[720px] flex flex-col items-center space-y-8 mt-16">

        {/* Voltar */}
        <div className="w-full flex justify-start">
          <button onClick={onBackToLogin}
            className="flex items-center gap-2 group transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium uppercase tracking-widest">Voltar para o Login</span>
          </button>
        </div>

        {/* Branding */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            Junta-te a Kamba<span style={{ color: 'var(--accent)' }}>Pro</span>
          </h1>
          <p className="text-sm font-light tracking-wide" style={{ color: 'var(--text-muted)' }}>Cria a tua conta e começa a tua jornada financeira.</p>
        </div>

        {/* Erro */}
        {error && (
          <div className="w-full p-4 rounded-lg text-sm flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-500/30">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nome Completo</label>
              <input name="nome" type="text" required minLength={2} placeholder="Nilton Costa" value={formData.nome} onChange={handleChange} style={inp} onFocus={focusAccent} onBlur={blurAccent} />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Endereço de email</label>
              <input name="email" type="email" required placeholder="email@exemplo.com" value={formData.email} onChange={handleChange} style={inp} onFocus={focusAccent} onBlur={blurAccent} />
            </div>
            {/* Telefone */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Número de Telefone</label>
              <input name="telefone" type="tel" required placeholder="923 123 456" value={formData.telefone} onChange={handleChange} style={inp} onFocus={focusAccent} onBlur={blurAccent} />
              <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--text-faint)' }}>Deve ter 9 dígitos e começar por 9 (ex: 923…)</p>
            </div>
            {/* Data Nascimento */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Data de Nascimento</label>
              <input name="dataNascimento" type="date" required value={formData.dataNascimento} onChange={handleChange} style={{ ...inp, colorScheme: 'dark' } as any} onFocus={focusAccent} onBlur={blurAccent} />
              <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--text-faint)' }}>Deve ter pelo menos 18 anos</p>
            </div>
            {/* Género */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Género</label>
              <select name="sexo" value={formData.sexo} onChange={handleChange} style={{ ...sel, background: `rgba(255,255,255,0.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 1rem center / 1.5em 1.5em` }} onFocus={focusAccent} onBlur={blurAccent}>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
            {/* Morada */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Morada</label>
              <input name="morada" type="text" required minLength={3} placeholder="Luanda, Angola" value={formData.morada} onChange={handleChange} style={inp} onFocus={focusAccent} onBlur={blurAccent} />
            </div>
            {/* Senha */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Palavra-passe</label>
              <div className="relative flex items-center">
                <input name="senha" type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Mínimo 8 caracteres" value={formData.senha} onChange={handleChange}
                  style={{ ...inp, paddingRight: 48 }} onFocus={focusAccent} onBlur={blurAccent} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 transition-colors" style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    }
                  </svg>
                </button>
              </div>
              <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--text-faint)' }}>Mínimo 8 caracteres</p>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6">
            <button type="submit" disabled={loading}
              className="w-full h-14 rounded-full font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
              {loading ? 'A criar conta…' : 'Criar Conta'}
            </button>
          </div>
        </form>

        {/* Link login */}
        <div className="text-center pt-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Já tens uma conta?{' '}
            <button onClick={onBackToLogin}
              className="font-semibold transition-colors underline underline-offset-4"
              style={{ color: 'var(--text-primary)', textDecorationColor: 'var(--accent-30)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}>
              Entrar
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center w-full">
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-40" style={{ color: 'var(--text-muted)' }}>
          © 2025 KAMBAPRO INTERNATIONAL. ALL RIGHTS RESERVED.
        </p>
      </footer>

      {/* Blobs decorativos */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none" style={{ backgroundColor: 'var(--accent)', opacity: 0.05 }} />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'var(--accent)', opacity: 0.05 }} />
    </div>
  );
};

export default Register;