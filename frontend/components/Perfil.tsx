// src/components/Perfil.tsx
import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, CreditCard, Shield,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, Camera,
  Calendar, Loader2, Save, KeyRound, BadgeCheck, ChevronRight
} from 'lucide-react';
import api from '../services/api';

interface PerfilData {
  id?: string;
  nome: string;
  email: string;
  telefone?: string;
  morada?: string;
  sexo?: string;
  dataNascimento?: string;
  rendaMensalMedia?: number;
  perfilDeRisco?: string;
  role?: string;
  verificado?: boolean;
  criadoEm?: string;
  ultimoLogin?: string;
}

const PERFIS_RISCO = [
  { value: 'CONSERVADOR', label: 'Conservador', desc: 'Preferes segurança' },
  { value: 'MOD_ERADO', label: 'Moderado', desc: 'Equilíbrio risco/retorno' },
  { value: 'ARROJADO', label: 'Arrojado', desc: 'Aceitas maior risco' },
];

const SEXOS = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'OUTRO', label: 'Outro' },
  { value: 'PREFIRO_NAO_DIZER', label: 'Prefiro não dizer' },
];

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const config = [
    null,
    { bar: 'bg-red-500', text: 'text-red-400', label: 'Fraca' },
    { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Razoável' },
    { bar: 'bg-blue-500', text: 'text-blue-400', label: 'Boa' },
    { bar: 'bg-[#cbfb46]', text: 'text-[#cbfb46]', label: 'Forte' },
  ];
  if (!password) return null;
  const c = config[score]!;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= score ? c.bar : 'bg-white/10'}`} />
        ))}
      </div>
      <p className={`text-xs font-bold ${c.text}`}>{c.label}</p>
    </div>
  );
};

const Perfil: React.FC = () => {
  const [perfil, setPerfil] = useState<PerfilData>({ nome: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'seguranca'>('info');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPwd, setShowPwd] = useState({ atual: false, nova: false, confirm: false });

  useEffect(() => { fetchPerfil(); }, []);
  useEffect(() => {
    if (feedback) { const t = setTimeout(() => setFeedback(null), 4000); return () => clearTimeout(t); }
  }, [feedback]);

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/perfil');
      if (data.success && data.usuario) {
        setPerfil({ ...data.usuario, rendaMensalMedia: Number(data.usuario.rendaMensalMedia) || 0 });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erro ao carregar perfil.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await api.patch('/auth/perfil', {
        nome: perfil.nome,
        telefone: perfil.telefone,
        morada: perfil.morada,
        sexo: perfil.sexo,
        rendaMensalMedia: perfil.rendaMensalMedia,
        perfilDeRisco: perfil.perfilDeRisco,
      });
      if (data.success) {
        setPerfil(prev => ({ ...prev, ...data.usuario }));
        setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.response?.data?.error?.message || 'Erro ao atualizar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmSenha) return setFeedback({ type: 'error', msg: 'As senhas não coincidem.' });
    if (novaSenha.length < 8) return setFeedback({ type: 'error', msg: 'Senha deve ter pelo menos 8 caracteres.' });
    setSavingPwd(true);
    setFeedback(null);
    try {
      const { data } = await api.patch('/auth/perfil', { senhaAtual, novaSenha });
      if (data.success) {
        setFeedback({ type: 'success', msg: 'Senha alterada com sucesso!' });
        setSenhaAtual(''); setNovaSenha(''); setConfirmSenha('');
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.response?.data?.error?.message || 'Senha atual incorreta.' });
    } finally {
      setSavingPwd(false);
    }
  };

  const initials = perfil.nome ? perfil.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'K';
  const memberSince = perfil.criadoEm ? new Date(perfil.criadoEm).toLocaleDateString('pt-AO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const lastLogin = perfil.ultimoLogin ? new Date(perfil.ultimoLogin).toLocaleString('pt-AO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 text-[#cbfb46] animate-spin" />
        <p className="text-white/40 text-sm font-medium">A carregar perfil...</p>
      </div>
    );
  }

  const InputField = ({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div>
      <label className="flex items-center gap-1.5 text-white/40 text-xs font-bold uppercase tracking-wider mb-2">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 pb-12">

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#cbfb46]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#cbfb46]/4 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#cbfb46] to-[#a8d936] flex items-center justify-center text-black font-black text-3xl shadow-[0_0_30px_rgba(203,251,70,0.25)]">
              {initials}
            </div>
            <button type="button" className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-black text-white">{perfil.nome || 'Utilizador'}</h1>
              {perfil.verificado && <BadgeCheck className="w-5 h-5 text-[#cbfb46]" />}
            </div>
            <p className="text-white/50 text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {perfil.email}
            </p>

            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
              {perfil.role && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#cbfb46]/10 border border-[#cbfb46]/20 rounded-full text-xs font-bold text-[#cbfb46]">
                  <Shield className="w-3 h-3" /> {perfil.role}
                </span>
              )}
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-full text-xs font-bold text-white/50">
                <Calendar className="w-3 h-3" /> {memberSince}
              </span>
              {lastLogin && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] border border-white/10 rounded-full text-xs font-bold text-white/40">
                  <CheckCircle className="w-3 h-3" /> Último login: {lastLogin}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1.5 bg-white/[0.03] rounded-2xl border border-white/10">
        {[
          { id: 'info', label: 'Informações', Icon: User },
          { id: 'seguranca', label: 'Segurança', Icon: Lock },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id as any); setFeedback(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === id ? 'bg-[#cbfb46] text-black shadow-[0_0_15px_rgba(203,251,70,0.2)]' : 'text-white/50 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-bold ${
          feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* TAB: Informações */}
      {activeTab === 'info' && (
        <form onSubmit={handleSavePerfil} className="space-y-5">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.07]">
              <div className="w-8 h-8 bg-[#cbfb46]/10 rounded-xl flex items-center justify-center">
                <User className="w-4 h-4 text-[#cbfb46]" />
              </div>
              <h3 className="text-white font-black text-base">Dados Pessoais</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField label="Nome Completo" icon={User}>
                  <input type="text" value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08] placeholder:text-white/20"
                    placeholder="O teu nome completo" />
                </InputField>
              </div>

              <InputField label="Email" icon={Mail}>
                <div className="relative">
                  <input type="email" value={perfil.email} disabled
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 pr-10 text-white/30 text-sm cursor-not-allowed" />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                </div>
              </InputField>

              <InputField label="Telefone" icon={Phone}>
                <input type="tel" value={perfil.telefone || ''} onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08] placeholder:text-white/20"
                  placeholder="+244 9XX XXX XXX" />
              </InputField>

              <div className="sm:col-span-2">
                <InputField label="Morada" icon={MapPin}>
                  <input type="text" value={perfil.morada || ''} onChange={e => setPerfil(p => ({ ...p, morada: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08] placeholder:text-white/20"
                    placeholder="Luanda, Angola" />
                </InputField>
              </div>

              <InputField label="Género" icon={User}>
                <select value={perfil.sexo || ''} onChange={e => setPerfil(p => ({ ...p, sexo: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08]">
                  <option value="" className="bg-[#0B0E11]">Seleciona...</option>
                  {SEXOS.map(s => <option key={s.value} value={s.value} className="bg-[#0B0E11]">{s.label}</option>)}
                </select>
              </InputField>

              {perfil.dataNascimento && (
                <InputField label="Data de Nascimento" icon={Calendar}>
                  <input type="text" value={new Date(perfil.dataNascimento).toLocaleDateString('pt-AO')} disabled
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-white/30 text-sm cursor-not-allowed" />
                </InputField>
              )}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.07]">
              <div className="w-8 h-8 bg-[#cbfb46]/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[#cbfb46]" />
              </div>
              <h3 className="text-white font-black text-base">Dados Financeiros</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Renda Mensal Média (Kz)" icon={CreditCard}>
                <input type="number" value={perfil.rendaMensalMedia || ''} onChange={e => setPerfil(p => ({ ...p, rendaMensalMedia: parseFloat(e.target.value) || 0 }))} min={0}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08] placeholder:text-white/20"
                  placeholder="Ex: 250000" />
              </InputField>

              <InputField label="Perfil de Risco" icon={Shield}>
                <select value={perfil.perfilDeRisco || ''} onChange={e => setPerfil(p => ({ ...p, perfilDeRisco: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08]">
                  <option value="" className="bg-[#0B0E11]">Seleciona...</option>
                  {PERFIS_RISCO.map(p => <option key={p.value} value={p.value} className="bg-[#0B0E11]">{p.label} — {p.desc}</option>)}
                </select>
              </InputField>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2.5 bg-[#cbfb46] hover:bg-[#b8e63e] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(203,251,70,0.2)]">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'A guardar...' : 'Guardar Alterações'}
          </button>
        </form>
      )}

      {/* TAB: Segurança */}
      {activeTab === 'seguranca' && (
        <form onSubmit={handleChangeSenha} className="space-y-5">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.07]">
              <div className="w-8 h-8 bg-[#cbfb46]/10 rounded-xl flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-[#cbfb46]" />
              </div>
              <h3 className="text-white font-black text-base">Alterar Palavra-passe</h3>
            </div>

            {[
              { label: 'Senha Atual', val: senhaAtual, set: setSenhaAtual, show: showPwd.atual, toggle: () => setShowPwd(s => ({ ...s, atual: !s.atual })), Icon: Lock },
              { label: 'Nova Senha', val: novaSenha, set: setNovaSenha, show: showPwd.nova, toggle: () => setShowPwd(s => ({ ...s, nova: !s.nova })), Icon: KeyRound },
              { label: 'Confirmar Nova Senha', val: confirmSenha, set: setConfirmSenha, show: showPwd.confirm, toggle: () => setShowPwd(s => ({ ...s, confirm: !s.confirm })), Icon: CheckCircle },
            ].map(({ label, val, set, show, toggle, Icon }) => (
              <div key={label}>
                <label className="flex items-center gap-1.5 text-white/40 text-xs font-bold uppercase tracking-wider mb-2">
                  <Icon className="w-3 h-3" /> {label}
                </label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} required
                    className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 pr-12 text-white text-sm focus:ring-2 focus:ring-[#cbfb46] outline-none transition-all focus:bg-white/[0.08] placeholder:text-white/20 ${
                      label === 'Confirmar Nova Senha' && confirmSenha && novaSenha !== confirmSenha ? 'border-red-500/50' : 'border-white/10'
                    }`}
                    placeholder={label === 'Nova Senha' ? 'Mínimo 8 caracteres' : '••••••••'} />
                  <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {label === 'Nova Senha' && <PasswordStrength password={novaSenha} />}
                {label === 'Confirmar Nova Senha' && confirmSenha && novaSenha !== confirmSenha && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> As senhas não coincidem</p>
                )}
              </div>
            ))}

            {/* Security checklist */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
              <p className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Shield className="w-3 h-3" /> Requisitos
              </p>
              {[
                ['Mínimo 8 caracteres', novaSenha.length >= 8],
                ['Uma letra maiúscula', /[A-Z]/.test(novaSenha)],
                ['Um número (0-9)', /[0-9]/.test(novaSenha)],
                ['Um símbolo especial', /[^A-Za-z0-9]/.test(novaSenha)],
              ].map(([tip, ok]) => (
                <div key={tip as string} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${novaSenha && ok ? 'bg-[#cbfb46]' : 'bg-white/10'}`}>
                    {novaSenha && ok && (
                      <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs ${novaSenha && ok ? 'text-white/60' : 'text-white/25'}`}>{tip as string}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={savingPwd || !senhaAtual || !novaSenha || novaSenha !== confirmSenha}
            className="w-full flex items-center justify-center gap-2.5 bg-[#cbfb46] hover:bg-[#b8e63e] disabled:opacity-40 disabled:cursor-not-allowed text-black font-black py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(203,251,70,0.2)]">
            {savingPwd ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
            {savingPwd ? 'A alterar...' : 'Alterar Senha'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Perfil;