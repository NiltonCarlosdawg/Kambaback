// src/components/Perfil.tsx
import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, CreditCard, Shield,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, Camera,
  Calendar, Loader2, Save, KeyRound, ArrowRight,
  TrendingUp, Wallet, Target, Sparkles
} from 'lucide-react';
import authService, { PerfilData } from '../services/authService';
import { useTheme } from '../contexts/ThemeContext';

const Perfil: React.FC = () => {
  const { formatMoney, maskValue } = useTheme();
  const [usuario,   setUsuario]   = useState<PerfilData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [message,   setMessage]   = useState({ text: '', type: '' });
  const [showPwd,   setShowPwd]   = useState(false);
  const [tab,       setTab]       = useState<'geral' | 'seguranca' | 'dados'>('geral');

  const [formData, setFormData] = useState({
    nome: '', email: '', telefone: '', morada: '', dataNascimento: '', rendaMensalMedia: 0
  });

  const [pwdData, setPwdData] = useState({ atual: '', nova: '', confirma: '' });

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const res = await authService.obterPerfil();
      if (res.success) {
        setUsuario(res.usuario);
        setFormData({
          nome: res.usuario.nome,
          email: res.usuario.email,
          telefone: res.usuario.telefone || '',
          morada: res.usuario.morada || '',
          dataNascimento: res.usuario.dataNascimento ? new Date(res.usuario.dataNascimento).toISOString().split('T')[0] : '',
          rendaMensalMedia: res.usuario.rendaMensalMedia || 0
        });
      }
    } catch { setMessage({ text: 'Falha ao carregar perfil', type: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPerfil(); }, []);

  const handleUpdatePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await authService.atualizarPerfil(formData);
      if (res.success) {
        setUsuario(res.usuario);
        setMessage({ text: 'Perfil actualizado com sucesso!', type: 'success' });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      }
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Erro ao actualizar perfil', type: 'error' });
    } finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdData.nova !== pwdData.confirma) return setMessage({ text: 'As senhas não coincidem', type: 'error' });
    try {
      setSavingPwd(true);
      await authService.alterarSenha(pwdData.atual, pwdData.nova);
      setMessage({ text: 'Senha alterada com sucesso!', type: 'success' });
      setPwdData({ atual: '', nova: '', confirma: '' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Erro ao alterar senha', type: 'error' });
    } finally { setSavingPwd(false); }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Sidebar Perfil */}
        <div className="w-full md:w-80 space-y-6">
          <div className="rounded-3xl border p-8 text-center space-y-4 relative overflow-hidden" 
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="absolute top-0 left-0 w-full h-24 bg-accent opacity-10" />
            
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent to-accent-dark mx-auto flex items-center justify-center text-4xl font-black text-accent-text shadow-xl">
                {usuario?.nome[0]}
              </div>
              <button className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-bg-surface border border-border text-text-faint hover:text-accent transition-colors">
                <Camera size={16} />
              </button>
            </div>

            <div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{usuario?.nome}</h3>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{usuario?.email}</p>
            </div>

            <div className="flex justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-10 text-accent border border-accent-20">
                {usuario?.role || 'Utilizador'}
              </span>
              {usuario?.verificado && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Shield size={10} /> Verificado
                </span>
              )}
            </div>
          </div>

          <nav className="rounded-3xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            {[
              { id: 'geral',     label: 'Geral',      icon: User },
              { id: 'dados',     label: 'Dados',      icon: CreditCard },
              { id: 'seguranca', label: 'Segurança',  icon: Lock },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-bold transition-all border-b last:border-0 ${tab === t.id ? 'bg-accent-10 text-accent' : 'text-text-muted hover:bg-white/[0.02]'}`}
                style={{ borderColor: 'var(--border)' }}>
                <t.icon size={18} />
                {t.label}
                {tab === t.id && <ArrowRight size={14} className="ml-auto" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 w-full">
          {message.text && (
            <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-bold">{message.text}</span>
            </div>
          )}

          <div className="rounded-3xl border p-8 space-y-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            
            {tab === 'geral' && (
              <form onSubmit={handleUpdatePerfil} className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <Sparkles size={20} className="text-accent" />
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Informações Pessoais</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Nome Completo</label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                      <input type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})}
                        className="w-full pl-12 pr-4 h-12 rounded-xl border outline-none transition-all focus:border-accent"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                      <input type="email" readOnly value={formData.email}
                        className="w-full pl-12 pr-4 h-12 rounded-xl border opacity-50 cursor-not-allowed"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Telemóvel</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                      <input type="text" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})}
                        className="w-full pl-12 pr-4 h-12 rounded-xl border outline-none transition-all focus:border-accent"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Data de Nascimento</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                      <input type="date" value={formData.dataNascimento} onChange={e => setFormData({...formData, dataNascimento: e.target.value})}
                        className="w-full pl-12 pr-4 h-12 rounded-xl border outline-none transition-all focus:border-accent"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Morada</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                    <input type="text" value={formData.morada} onChange={e => setFormData({...formData, morada: e.target.value})}
                      className="w-full pl-12 pr-4 h-12 rounded-xl border outline-none transition-all focus:border-accent"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'A guardar…' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'dados' && (
              <form onSubmit={handleUpdatePerfil} className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <TrendingUp size={20} className="text-accent" />
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Dados Financeiros</h4>
                </div>

                <div className="space-y-2 max-w-sm">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Renda Mensal Média (Kz)</label>
                  <div className="relative">
                    <Wallet size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                    <input type="number" value={formData.rendaMensalMedia} onChange={e => setFormData({...formData, rendaMensalMedia: Number(e.target.value)})}
                      className="w-full pl-12 pr-4 h-12 rounded-xl border outline-none font-bold"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Este valor ajuda o Kamba AI a dar melhores conselhos financeiros.</p>
                </div>

                <div className="p-4 rounded-2xl border bg-accent-10" style={{ borderColor: 'var(--accent-20)' }}>
                  <div className="flex gap-3">
                    <Target size={20} className="text-accent shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-accent">Dica do Kamba</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        Com uma renda de <strong>{maskValue(formatMoney(formData.rendaMensalMedia))}</strong>, sugerimos que reserves pelo menos 
                        <strong> {maskValue(formatMoney(formData.rendaMensalMedia * 0.2))}</strong> (20%) para poupança e investimentos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'A guardar…' : 'Actualizar Dados'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'seguranca' && (
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <KeyRound size={20} className="text-accent" />
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Alterar Senha</h4>
                </div>

                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Senha Actual</label>
                    <input type="password" required value={pwdData.atual} onChange={e => setPwdData({...pwdData, atual: e.target.value})}
                      className="w-full px-4 h-12 rounded-xl border outline-none"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Nova Senha</label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} required value={pwdData.nova} onChange={e => setPwdData({...pwdData, nova: e.target.value})}
                        className="w-full px-4 h-12 rounded-xl border outline-none"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint">
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 opacity-50">Confirmar Nova Senha</label>
                    <input type="password" required value={pwdData.confirma} onChange={e => setPwdData({...pwdData, confirma: e.target.value})}
                      className="w-full px-4 h-12 rounded-xl border outline-none"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={savingPwd}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                    {savingPwd ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                    {savingPwd ? 'A alterar…' : 'Alterar Senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;
