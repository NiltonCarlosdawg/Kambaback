// src/components/Perfil.tsx
import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, CreditCard, Shield,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, Camera,
  Calendar, Loader2, Save, KeyRound, BadgeCheck,
} from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface PerfilData {
  id?: string; nome: string; email: string; telefone?: string; morada?: string;
  sexo?: string; dataNascimento?: string; rendaMensalMedia?: number;
  perfilDeRisco?: string; role?: string; verificado?: boolean;
  criadoEm?: string; ultimoLogin?: string;
}

const PERFIS_RISCO = [
  { value: 'CONSERVADOR', label: 'Conservador', desc: 'Preferes segurança' },
  { value: 'MOD_ERADO',   label: 'Moderado',    desc: 'Equilíbrio risco/retorno' },
  { value: 'ARROJADO',    label: 'Arrojado',     desc: 'Aceitas maior risco' },
];

const SEXOS = [
  { value: 'MASCULINO',         label: 'Masculino' },
  { value: 'FEMININO',          label: 'Feminino' },
  { value: 'OUTRO',             label: 'Outro' },
  { value: 'PREFIRO_NAO_DIZER', label: 'Prefiro não dizer' },
];

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const configs = [
    null,
    { bar: 'bg-red-500',    textColor: '#f87171', label: 'Fraca' },
    { bar: 'bg-yellow-500', textColor: '#facc15', label: 'Razoável' },
    { bar: 'bg-blue-500',   textColor: '#60a5fa', label: 'Boa' },
    { bar: '',              textColor: null,      label: 'Forte', accent: true },
  ];
  if (!password) return null;
  const c = configs[score]!;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1,2,3,4].map(i => (
          <div key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${i <= score && !c.accent ? c.bar : i > score ? 'bg-white/10' : ''}`}
            style={i <= score && c.accent ? { backgroundColor: 'var(--accent)' } : {}} />
        ))}
      </div>
      <p className="text-xs font-bold" style={{ color: c.accent ? 'var(--accent)' : c.textColor! }}>{c.label}</p>
    </div>
  );
};

const Perfil: React.FC = () => {
  const { formatDate, maskValue } = useTheme();

  const [perfil,       setPerfil]       = useState<PerfilData>({ nome: '', email: '' });
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [savingPwd,    setSavingPwd]    = useState(false);
  const [activeTab,    setActiveTab]    = useState<'info' | 'seguranca'>('info');
  const [feedback,     setFeedback]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [senhaAtual,   setSenhaAtual]   = useState('');
  const [novaSenha,    setNovaSenha]    = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPwd,      setShowPwd]      = useState({ atual: false, nova: false, confirm: false });

  useEffect(() => { fetchPerfil(); }, []);
  useEffect(() => {
    if (feedback) { const t = setTimeout(() => setFeedback(null), 4000); return () => clearTimeout(t); }
  }, [feedback]);

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/perfil');
      if (data.success && data.usuario) setPerfil({ ...data.usuario, rendaMensalMedia: Number(data.usuario.rendaMensalMedia) || 0 });
    } catch { setFeedback({ type: 'error', msg: 'Erro ao carregar perfil.' }); }
    finally { setLoading(false); }
  };

  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFeedback(null);
    try {
      const { data } = await api.patch('/auth/perfil', { nome: perfil.nome, telefone: perfil.telefone, morada: perfil.morada, sexo: perfil.sexo, rendaMensalMedia: perfil.rendaMensalMedia, perfilDeRisco: perfil.perfilDeRisco });
      if (data.success) { setPerfil(prev => ({ ...prev, ...data.usuario })); setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' }); }
    } catch (e: any) { setFeedback({ type: 'error', msg: e.response?.data?.error?.message || 'Erro ao atualizar perfil.' }); }
    finally { setSaving(false); }
  };

  const handleChangeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmSenha) return setFeedback({ type: 'error', msg: 'As senhas não coincidem.' });
    if (novaSenha.length < 8) return setFeedback({ type: 'error', msg: 'Senha deve ter pelo menos 8 caracteres.' });
    setSavingPwd(true); setFeedback(null);
    try {
      const { data } = await api.post('/auth/alterar-senha', { senhaAtual, novaSenha });
      if (data.success) { setFeedback({ type: 'success', msg: 'Senha alterada com sucesso!' }); setSenhaAtual(''); setNovaSenha(''); setConfirmSenha(''); }
    } catch (e: any) { setFeedback({ type: 'error', msg: e.response?.data?.error?.message || 'Senha atual incorreta.' }); }
    finally { setSavingPwd(false); }
  };

  const initials    = perfil.nome ? perfil.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'K';
  const memberSince = perfil.criadoEm    ? formatDate(perfil.criadoEm)    : '—';
  const lastLogin   = perfil.ultimoLogin ? formatDate(perfil.ultimoLogin)  : null;

  // shared styles
  const inp: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', transition: 'background-color var(--transition-speed,200ms), box-shadow var(--transition-speed,200ms)' };
  const inpDisabled: React.CSSProperties = { ...inp, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)', cursor: 'not-allowed' };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' };
  const fa = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.08)'; };
  const fb = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; };

  const InputField = ({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>A carregar perfil…</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 pb-12">

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl p-8" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'var(--accent)', opacity: 0.08 }} />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-2xl pointer-events-none" style={{ backgroundColor: 'var(--accent)', opacity: 0.04 }} />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black"
              style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-dark))`, color: 'var(--accent-text)', boxShadow: '0 0 30px var(--accent-20)' }}>
              {initials}
            </div>
            <button type="button" className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/60">
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{perfil.nome || 'Utilizador'}</h1>
              {perfil.verificado && <BadgeCheck className="w-5 h-5" style={{ color: 'var(--accent)' }} />}
            </div>
            <p className="text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Mail className="w-3.5 h-3.5" /> {perfil.email}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
              {perfil.role && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--accent-10)', border: '1px solid var(--accent-20)', color: 'var(--accent)' }}>
                  <Shield className="w-3 h-3" /> {perfil.role}
                </span>
              )}
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                <Calendar className="w-3 h-3" /> {memberSince}
              </span>
              {lastLogin && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  <CheckCircle className="w-3 h-3" /> Último login: {lastLogin}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
        {[{ id: 'info', label: 'Informações', Icon: User }, { id: 'seguranca', label: 'Segurança', Icon: Lock }].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { setActiveTab(id as any); setFeedback(null); }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={activeTab === id
              ? { backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 15px var(--accent-20)' }
              : { color: 'var(--text-faint)' }}
            onMouseEnter={e => { if (activeTab !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (activeTab !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-bold ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* TAB: Informações */}
      {activeTab === 'info' && (
        <form onSubmit={handleSavePerfil} className="space-y-5">
          <div className="rounded-3xl p-6 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
                <User className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-black text-base" style={{ color: 'var(--text-primary)' }}>Dados Pessoais</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField label="Nome Completo" icon={User}>
                  <input type="text" value={perfil.nome} placeholder="O teu nome completo"
                    onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))} style={inp} onFocus={fa} onBlur={fb} />
                </InputField>
              </div>
              <InputField label="Email" icon={Mail}>
                <div className="relative">
                  <input type="email" value={perfil.email} disabled style={{ ...inpDisabled, paddingRight: 40 }} />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
                </div>
              </InputField>
              <InputField label="Telefone" icon={Phone}>
                <input type="tel" value={perfil.telefone || ''} placeholder="+244 9XX XXX XXX"
                  onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))} style={inp} onFocus={fa} onBlur={fb} />
              </InputField>
              <div className="sm:col-span-2">
                <InputField label="Morada" icon={MapPin}>
                  <input type="text" value={perfil.morada || ''} placeholder="Luanda, Angola"
                    onChange={e => setPerfil(p => ({ ...p, morada: e.target.value }))} style={inp} onFocus={fa} onBlur={fb} />
                </InputField>
              </div>
              <InputField label="Género" icon={User}>
                <select value={perfil.sexo || ''} onChange={e => setPerfil(p => ({ ...p, sexo: e.target.value }))} style={sel} onFocus={fa} onBlur={fb}>
                  <option value="" style={{ backgroundColor: 'var(--bg-base)' }}>Seleciona…</option>
                  {SEXOS.map(s => <option key={s.value} value={s.value} style={{ backgroundColor: 'var(--bg-base)' }}>{s.label}</option>)}
                </select>
              </InputField>
              {perfil.dataNascimento && (
                <InputField label="Data de Nascimento" icon={Calendar}>
                  <input type="text" value={formatDate(perfil.dataNascimento)} disabled style={inpDisabled} />
                </InputField>
              )}
            </div>
          </div>

          <div className="rounded-3xl p-6 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
                <CreditCard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-black text-base" style={{ color: 'var(--text-primary)' }}>Dados Financeiros</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Renda Mensal Média (Kz)" icon={CreditCard}>
                <input type="number" min={0} placeholder="Ex: 250000"
                  value={perfil.rendaMensalMedia || ''}
                  onChange={e => setPerfil(p => ({ ...p, rendaMensalMedia: parseFloat(e.target.value) || 0 }))}
                  style={inp} onFocus={fa} onBlur={fb} />
              </InputField>
              <InputField label="Perfil de Risco" icon={Shield}>
                <select value={perfil.perfilDeRisco || ''} onChange={e => setPerfil(p => ({ ...p, perfilDeRisco: e.target.value }))} style={sel} onFocus={fa} onBlur={fb}>
                  <option value="" style={{ backgroundColor: 'var(--bg-base)' }}>Seleciona…</option>
                  {PERFIS_RISCO.map(p => <option key={p.value} value={p.value} style={{ backgroundColor: 'var(--bg-base)' }}>{p.label} — {p.desc}</option>)}
                </select>
              </InputField>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2.5 font-black py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: 'none' }}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'A guardar…' : 'Guardar Alterações'}
          </button>
        </form>
      )}

      {/* TAB: Segurança */}
      {activeTab === 'seguranca' && (
        <form onSubmit={handleChangeSenha} className="space-y-5">
          <div className="rounded-3xl p-6 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
                <KeyRound className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-black text-base" style={{ color: 'var(--text-primary)' }}>Alterar Palavra-passe</h3>
            </div>

            {[
              { label: 'Senha Atual',          val: senhaAtual,   set: setSenhaAtual,   show: showPwd.atual,   toggle: () => setShowPwd(s => ({ ...s, atual:   !s.atual   })), Icon: Lock },
              { label: 'Nova Senha',           val: novaSenha,    set: setNovaSenha,    show: showPwd.nova,    toggle: () => setShowPwd(s => ({ ...s, nova:    !s.nova    })), Icon: KeyRound },
              { label: 'Confirmar Nova Senha', val: confirmSenha, set: setConfirmSenha, show: showPwd.confirm, toggle: () => setShowPwd(s => ({ ...s, confirm: !s.confirm })), Icon: CheckCircle },
            ].map(({ label, val, set, show, toggle, Icon }) => {
              const isConfirm  = label === 'Confirmar Nova Senha';
              const isMismatch = isConfirm && val && novaSenha !== val;
              return (
                <div key={label}>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                    <Icon className="w-3 h-3" /> {label}
                  </label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} required value={val} onChange={e => set(e.target.value)}
                      placeholder={label === 'Nova Senha' ? 'Mínimo 8 caracteres' : '••••••••'}
                      style={{ ...inp, paddingRight: 48, borderColor: isMismatch ? 'rgba(239,68,68,0.5)' : 'var(--border)' }}
                      onFocus={fa} onBlur={fb} />
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {label === 'Nova Senha' && <PasswordStrength password={novaSenha} />}
                  {isMismatch && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> As senhas não coincidem
                    </p>
                  )}
                </div>
              );
            })}

            {/* Requisitos */}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-3" style={{ color: 'var(--text-faint)' }}>
                <Shield className="w-3 h-3" /> Requisitos
              </p>
              {[
                ['Mínimo 8 caracteres', novaSenha.length >= 8],
                ['Uma letra maiúscula', /[A-Z]/.test(novaSenha)],
                ['Um número (0-9)',     /[0-9]/.test(novaSenha)],
                ['Um símbolo especial', /[^A-Za-z0-9]/.test(novaSenha)],
              ].map(([tip, ok]) => (
                <div key={tip as string} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ backgroundColor: novaSenha && ok ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }}>
                    {novaSenha && ok && (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--accent-text)' }}>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: novaSenha && ok ? 'var(--text-muted)' : 'var(--text-faint)' }}>{tip as string}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={savingPwd || !senhaAtual || !novaSenha || novaSenha !== confirmSenha}
            className="w-full flex items-center justify-center gap-2.5 font-black py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: 'none' }}>
            {savingPwd ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
            {savingPwd ? 'A alterar…' : 'Alterar Senha'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Perfil;