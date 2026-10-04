// src/components/Register.tsx
import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, UserPlus } from 'lucide-react';
import api, { setAccessToken } from '../services/api';
import { AuthResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface RegisterProps {
  onRegisterSuccess: (user: any) => void;
  onBackToLogin: () => void;
}

// ─── Shared inline components ────────────────────────────────────────────────
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>{label}</label>
    {children}
    {hint && <p className="text-[10px] mt-1.5 ml-0.5" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>{hint}</p>}
  </div>
);

const inputCss: React.CSSProperties = {
  width: '100%', height: 48, borderRadius: 12, padding: '0 16px',
  color: 'var(--text-primary)', outline: 'none', fontSize: 14,
  transition: 'border-color 150ms, box-shadow 150ms, background-color 150ms',
  backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)',
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [f, setF] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e  => { setF(false); props.onBlur?.(e); }}
      style={{
        ...inputCss, ...(props.style || {}),
        border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none',
      }}
    />
  );
};

const Sel: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  const [f, setF] = useState(false);
  return (
    <select
      {...props}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e  => { setF(false); props.onBlur?.(e); }}
      style={{
        ...inputCss, ...(props.style || {}),
        appearance: 'none' as any, cursor: 'pointer',
        border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em',
      }}
    />
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onBackToLogin }) => {
  const { prefs } = useTheme();

  const [formData, setFormData] = useState({
    nome: '', email: '', telefone: '', dataNascimento: '',
    sexo: 'Masculino', morada: '', senha: '',
  });
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
    const today = new Date(), birth = new Date(d);
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
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) { setError('O telefone deve ter 9 dígitos e começar por 9 (ex: 923...).'); return; }
    if (formData.senha.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const payload = { ...formData, dataNascimento: new Date(formData.dataNascimento).toISOString(), telefone: cleanPhone };
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      if (data.success) {
        const authUser = data.user ?? data.usuario;
        if (data.accessToken) {
          // F-019: access em memória; refresh fica no cookie httpOnly do backend
          setAccessToken(data.accessToken);
          if (!authUser) {
            setError('Resposta de autenticação inválida.');
            return;
          }
          onRegisterSuccess(authUser);
        } else { alert('Conta criada! Faz login.'); onBackToLogin(); }
      }
    } catch (err: any) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-start overflow-x-hidden px-4 py-16 font-sans antialiased animate-in fade-in duration-500"
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
      </header>

      <div className="w-full max-w-[640px] mt-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
        {/* Back */}
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 mb-8 transition-colors group"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; }}
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Voltar ao login</span>
        </button>

        {/* Heading */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl ring-1 ring-inset mb-4"
            style={{ backgroundColor: 'var(--accent-10)' }}>
            <UserPlus size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            Criar conta
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Preenche os teus dados para começar a jornada financeira.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="md:col-span-2">
              <Field label="Nome completo">
                <Input name="nome" type="text" required minLength={2} placeholder="Nilton Costa"
                  autoComplete="name"
                  value={formData.nome} onChange={handle} />
              </Field>
            </div>

            <Field label="Email">
              <Input name="email" type="email" required placeholder="email@exemplo.com"
                autoComplete="email"
                value={formData.email} onChange={handle} />
            </Field>

            <Field label="Telefone" hint="9 dígitos, começa por 9 (ex: 923…)">
              <Input name="telefone" type="tel" required placeholder="923 123 456"
                autoComplete="tel"
                value={formData.telefone} onChange={handle} />
            </Field>

            <Field label="Data de nascimento" hint="Mínimo 18 anos">
              <Input name="dataNascimento" type="date" required
                autoComplete="bday"
                value={formData.dataNascimento} onChange={handle}
                style={{ colorScheme: 'dark' } as any} />
            </Field>

            <Field label="Género">
              <Sel name="sexo" value={formData.sexo} onChange={handle}>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </Sel>
            </Field>

            <div className="md:col-span-2">
              <Field label="Morada">
                <Input name="morada" type="text" required minLength={3} placeholder="Luanda, Angola"
                  autoComplete="street-address"
                  value={formData.morada} onChange={handle} />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Palavra-passe" hint="Mínimo 8 caracteres">
                <div className="relative">
                  <Input
                    name="senha"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={formData.senha}
                    onChange={handle}
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
              </Field>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-xl font-medium text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              {loading ? 'A criar conta…' : 'Criar conta'}
            </button>
          </div>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: 'var(--text-faint)' }}>
          Já tens conta?{' '}
          <button
            onClick={onBackToLogin}
            className="font-semibold transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-primary)'; }}
          >
            Entrar
          </button>
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 text-center w-full">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-faint)', opacity: 0.4 }}>
          © 2025 KambaPro International
        </p>
      </footer>

      {/* Blobs */}
      <div className="absolute top-1/4 -left-32 w-72 h-72 rounded-full blur-[120px] pointer-events-none"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.05 }} />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-[140px] pointer-events-none"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.04 }} />
    </div>
  );
};

export default Register;
