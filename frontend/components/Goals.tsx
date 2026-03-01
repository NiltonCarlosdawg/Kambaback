// src/components/Goals.tsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Objetivo } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const Goals: React.FC = () => {
  const { formatMoney, maskValue, formatDate } = useTheme();

  const [objetivos,         setObjetivos]         = useState<Objetivo[]>([]);
  const [concluidos,        setConcluidos]        = useState<Objetivo[]>([]);
  const [resumo,            setResumo]            = useState<any>(null);
  const [loading,           setLoading]           = useState(true);
  const [showModal,         setShowModal]         = useState(false);
  const [showDepositModal,  setShowDepositModal]  = useState(false);
  const [error,             setError]             = useState('');
  const [editMode,          setEditMode]          = useState(false);
  const [selectedGoal,      setSelectedGoal]      = useState<Objetivo | null>(null);
  const [depositAmount,     setDepositAmount]     = useState('');
  const [formData, setFormData] = useState({
    titulo: '', valorAlvo: '', dataPrevista: '', valorAtual: '0',
    categoria: 'Geral', prioridade: 'MEDIA', porcentagemDistribuicao: '0',
  });

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/objetivos');
      setObjetivos(data.objetivos || []); setConcluidos(data.concluidos || []); setResumo(data.resumo);
    } catch { setError('Falha ao carregar objetivos'); }
    finally { setLoading(false); }
  };

  const handleOpenModal = (obj?: Objetivo) => {
    setError('');
    if (obj) {
      setEditMode(true); setSelectedGoal(obj);
      setFormData({ titulo: obj.titulo, valorAlvo: obj.valorAlvo.toString(), dataPrevista: obj.dataPrevista ? new Date(obj.dataPrevista).toISOString().split('T')[0] : '', valorAtual: obj.valorAtual.toString(), categoria: obj.categoria || 'Geral', prioridade: obj.prioridade || 'MEDIA', porcentagemDistribuicao: (obj.porcentagemDistribuicao || 0).toString() });
    } else {
      setEditMode(false); setSelectedGoal(null);
      setFormData({ titulo: '', valorAlvo: '', dataPrevista: '', valorAtual: '0', categoria: 'Geral', prioridade: 'MEDIA', porcentagemDistribuicao: '0' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, valorAlvo: Number(formData.valorAlvo), valorAtual: Number(formData.valorAtual), porcentagemDistribuicao: Number(formData.porcentagemDistribuicao), dataPrevista: formData.dataPrevista };
      if (editMode && selectedGoal) { await api.put(`/objetivos/${selectedGoal.id}`, payload); }
      else { await api.post('/objetivos', payload); }
      setShowModal(false); fetchGoals();
    } catch (err: any) { setError(err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tens certeza que queres remover este objetivo?')) return;
    try { await api.delete(`/objetivos/${id}`); fetchGoals(); }
    catch (err: any) { setError(err.response?.data?.message || 'Erro ao remover'); }
  };

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !depositAmount) return;
    try {
      await api.post('/gastos', { descricao: `Depósito manual: ${selectedGoal.titulo}`, valor: Number(depositAmount), tipo: 'DESPESA', cartaoId: '', categoriaId: '', objetivoId: selectedGoal.id, data: new Date().toISOString() });
      setShowDepositModal(false); setDepositAmount(''); fetchGoals();
    } catch (err: any) { setError(err.response?.data?.message || 'Erro ao depositar'); }
  };

  const getDaysRemaining = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  const prioridadeColors: Record<string, { bg: string; text: string; border: string }> = {
    URGENTE: { bg: 'rgba(239,68,68,0.2)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
    ALTA:    { bg: 'rgba(249,115,22,0.2)', text: '#fb923c', border: 'rgba(249,115,22,0.3)' },
    MEDIA:   { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    BAIXA:   { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  };

  const inp: React.CSSProperties = { width: '100%', height: 48, backgroundColor: 'var(--bg-base)', border: 'none', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'box-shadow 200ms' };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' };
  const fa = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 1px var(--accent)'; };
  const fb = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Carregando objetivos…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Resumo KPIs */}
      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Objetivos Ativos',  value: resumo.totalObjetivos, color: 'var(--text-primary)', bg: 'from-purple-500 to-purple-600' },
            { label: 'Total Acumulado',   value: maskValue(formatMoney(Number(resumo.totalAtual))), color: 'var(--accent)', bg: 'from-green-500 to-emerald-600' },
            { label: 'Meta Total',        value: maskValue(formatMoney(Number(resumo.totalAlvo))), color: 'var(--text-primary)', bg: 'from-blue-500 to-indigo-600' },
            { label: 'Progresso Geral',   value: `${resumo.progressoGeral}%`, color: '#34d399', bg: 'from-emerald-500 to-green-600' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="relative overflow-hidden group" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
              <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${bg} rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity`} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-4xl font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Planeia e alcança as tuas metas</p>
        </div>
        <button onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo Objetivo
        </button>
      </div>

      {/* Em Progresso */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Em Progresso</h2>
        {objetivos.length === 0 ? (
          <div className="p-12 text-center rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Nenhum objetivo ativo</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>Cria o teu primeiro objetivo financeiro</p>
                <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 font-medium text-sm" style={{ color: 'var(--accent)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Criar objetivo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {objetivos.map(obj => {
              const progresso = Math.min(Math.round((Number(obj.valorAtual) / Number(obj.valorAlvo)) * 100), 100);
              const pc = prioridadeColors[obj.prioridade] || prioridadeColors.BAIXA;
              const daysLeft = getDaysRemaining(obj.dataPrevista);
              return (
                <div key={obj.id} className="p-6 rounded-2xl group transition-all"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-10)' }}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</h3>
                        {obj.categoria && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{obj.categoria}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(obj)} className="p-2 rounded-lg transition-colors text-blue-400 hover:bg-blue-500/20">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(obj.id)} className="p-2 rounded-lg transition-colors text-red-400 hover:bg-red-500/20">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>{obj.prioridade}</span>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{daysLeft}d restantes</span>
                    )}
                  </div>
                  {obj.porcentagemDistribuicao > 0 && (
                    <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg mb-4" style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Auto-distribuição: {obj.porcentagemDistribuicao}%
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(Number(obj.valorAtual)))}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{maskValue(formatMoney(Number(obj.valorAlvo)))}</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progresso}%`, backgroundColor: 'var(--accent)' }} />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{progresso}% concluído</p>
                      <button onClick={() => { setSelectedGoal(obj); setShowDepositModal(true); }} className="text-xs font-bold transition-colors" style={{ color: 'var(--accent)' }}>+ Adicionar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Concluídos */}
      {concluidos.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Concluídos 🏆</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concluidos.map(obj => (
              <div key={obj.id} className="p-6 rounded-2xl relative overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full blur-3xl opacity-20" />
                <div className="relative flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/20">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-full font-bold">Concluído</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</h3>
                <p className="text-emerald-400 font-black text-xl">{maskValue(formatMoney(Number(obj.valorAlvo)))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editMode ? 'Editar Objetivo' : 'Novo Objetivo'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-faint)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {error && <div className="mb-4 p-3 rounded-lg text-sm text-red-400 bg-red-900/20 border border-red-500/30">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Título</label><input type="text" required placeholder="Ex: Viagem para Dubai" value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} style={inp} onFocus={fa} onBlur={fb} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Valor Alvo (Kz)</label><input type="number" step="0.01" required placeholder="0.00" value={formData.valorAlvo} onChange={e => setFormData({ ...formData, valorAlvo: e.target.value })} style={inp} onFocus={fa} onBlur={fb} /></div>
                  <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Data Prevista</label><input type="date" required value={formData.dataPrevista} onChange={e => setFormData({ ...formData, dataPrevista: e.target.value })} style={{ ...inp, colorScheme: 'dark' } as any} onFocus={fa} onBlur={fb} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Prioridade</label>
                    <select value={formData.prioridade} onChange={e => setFormData({ ...formData, prioridade: e.target.value })} style={sel} onFocus={fa} onBlur={fb}>
                      <option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Categoria</label><input type="text" placeholder="Ex: Viagem" value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} style={inp} onFocus={fa} onBlur={fb} /></div>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Distribuição Automática (%)
                  </label>
                  <input type="number" min="0" max="100" step="0.01" placeholder="0" value={formData.porcentagemDistribuicao} onChange={e => setFormData({ ...formData, porcentagemDistribuicao: e.target.value })} style={{ ...inp, border: '1px solid rgba(59,130,246,0.3)' }} onFocus={e => { e.target.style.boxShadow = '0 0 0 1px #3b82f6'; }} onBlur={fb} />
                  <p className="text-xs text-blue-400/80 mt-2">Percentagem das receitas direcionadas automaticamente para este objetivo.</p>
                </div>
                <button type="submit" className="w-full h-12 rounded-xl font-bold transition-all" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
                  {editMode ? 'Guardar Alterações' : 'Criar Objetivo'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Depósito */}
      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Adicionar ao Objetivo</h3>
                <button onClick={() => setShowDepositModal(false)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-faint)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Quanto queres guardar para <strong style={{ color: 'var(--text-primary)' }}>{selectedGoal.titulo}</strong>?</p>
              <form onSubmit={handleQuickDeposit} className="space-y-4">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <input type="number" step="0.01" autoFocus placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                    style={{ ...inp, paddingLeft: 48, height: 56, fontSize: 20, fontWeight: 700 }} onFocus={fa} onBlur={fb} />
                </div>
                <div className="p-3 rounded-lg text-xs text-yellow-400" style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                  Nota: Isto criará uma despesa na conta selecionada e adicionará o valor ao objetivo.
                </div>
                <button type="submit" className="w-full h-12 rounded-xl font-bold transition-all" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
                  Confirmar Depósito
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;