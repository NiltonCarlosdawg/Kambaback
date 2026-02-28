import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Objetivo } from '../types';

const Goals: React.FC = () => {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [concluidos, setConcluidos] = useState<Objetivo[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [error, setError] = useState('');
  
  const [editMode, setEditMode] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Objetivo | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  
  const [formData, setFormData] = useState({
    titulo: '',
    valorAlvo: '',
    dataPrevista: '',
    valorAtual: '0',
    categoria: 'Geral',
    prioridade: 'MEDIA',
    porcentagemDistribuicao: '0'
  });

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/objetivos');
      setObjetivos(data.objetivos || []);
      setConcluidos(data.concluidos || []);
      setResumo(data.resumo);
    } catch (err) { 
      setError('Falha ao carregar objetivos'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenModal = (obj?: Objetivo) => {
    setError('');
    if (obj) {
      setEditMode(true);
      setSelectedGoal(obj);
      setFormData({
        titulo: obj.titulo,
        valorAlvo: obj.valorAlvo.toString(),
        dataPrevista: obj.dataPrevista ? new Date(obj.dataPrevista).toISOString().split('T')[0] : '',
        valorAtual: obj.valorAtual.toString(),
        categoria: obj.categoria || 'Geral',
        prioridade: obj.prioridade || 'MEDIA',
        porcentagemDistribuicao: (obj.porcentagemDistribuicao || 0).toString()
      });
    } else {
      setEditMode(false);
      setSelectedGoal(null);
      setFormData({ 
        titulo: '', 
        valorAlvo: '', 
        dataPrevista: '', 
        valorAtual: '0', 
        categoria: 'Geral', 
        prioridade: 'MEDIA',
        porcentagemDistribuicao: '0'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { 
        ...formData, 
        valorAlvo: Number(formData.valorAlvo), 
        valorAtual: Number(formData.valorAtual),
        porcentagemDistribuicao: Number(formData.porcentagemDistribuicao),
        dataPrevista: formData.dataPrevista 
      };
      
      if (editMode && selectedGoal) {
        await api.put(`/objetivos/${selectedGoal.id}`, payload);
      } else {
        await api.post('/objetivos', payload);
      }
      setShowModal(false);
      fetchGoals();
    } catch (err: any) { 
      setError(err.response?.data?.message || 'Erro ao salvar'); 
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tens certeza que queres remover este objetivo?')) return;
    try {
      await api.delete(`/objetivos/${id}`);
      fetchGoals();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao remover');
    }
  };

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !depositAmount) return;

    try {
      await api.post('/gastos', {
        descricao: `Depósito manual: ${selectedGoal.titulo}`,
        valor: Number(depositAmount),
        tipo: 'DESPESA',
        cartaoId: '',
        categoriaId: '',
        objetivoId: selectedGoal.id,
        data: new Date().toISOString()
      });
      
      setShowDepositModal(false);
      setDepositAmount('');
      fetchGoals();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao depositar');
    }
  };

  const getPrioridadeColor = (p: string) => {
    switch(p) {
      case 'URGENTE': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
      case 'ALTA': return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
      case 'MEDIA': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
      case 'BAIXA': return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
      default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
    }
  };

  const formatCurrency = (value: number) => {
    return Number(value).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' });
  };

  const getDaysRemaining = (date?: string) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#cbfb46] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm font-medium">Carregando objetivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Resumo Cards */}
      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <p className="text-white/50 text-sm font-medium mb-1">Objetivos Ativos</p>
              <p className="text-4xl font-black text-white">{resumo.totalObjetivos}</p>
            </div>
          </div>
          <div className="relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <p className="text-white/50 text-sm font-medium mb-1">Total Acumulado</p>
              <p className="text-4xl font-black text-[#cbfb46]">
                {formatCurrency(Number(resumo.totalAtual))}
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <p className="text-white/50 text-sm font-medium mb-1">Meta Total</p>
              <p className="text-4xl font-black text-white">
                {formatCurrency(Number(resumo.totalAlvo))}
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <p className="text-white/50 text-sm font-medium mb-1">Progresso Geral</p>
              <p className="text-4xl font-black text-emerald-400">{resumo.progressoGeral}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#cbfb46]/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-[#cbfb46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-white/40">Planeia e alcança as tuas metas</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-[#cbfb46] hover:bg-[#b8e63e] text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(203,251,70,0.2)] hover:scale-[1.02]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Objetivo
        </button>
      </div>

      {/* Objetivos Ativos */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white">Em Progresso</h2>
        {objetivos.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2">Nenhum objetivo ativo</h3>
                <p className="text-white/40 text-sm mb-4">Cria o teu primeiro objetivo financeiro</p>
                <button 
                  onClick={() => handleOpenModal()}
                  className="inline-flex items-center gap-2 text-[#cbfb46] hover:text-[#b8e63e] font-medium text-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Criar objetivo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {objetivos.map((obj) => {
              const progresso = Math.min(Math.round((Number(obj.valorAtual) / Number(obj.valorAlvo)) * 100), 100);
              const prioridadeStyle = getPrioridadeColor(obj.prioridade);
              const daysLeft = getDaysRemaining(obj.dataPrevista);
              
              return (
                <div key={obj.id} className="bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#cbfb46]/20 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#cbfb46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{obj.titulo}</h3>
                        {obj.categoria && (
                          <span className="text-xs text-white/40">{obj.categoria}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(obj)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(obj.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${prioridadeStyle.bg} ${prioridadeStyle.text} ${prioridadeStyle.border}`}>
                      {obj.prioridade}
                    </span>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-white/60 border border-white/10">
                        {daysLeft}d restantes
                      </span>
                    )}
                  </div>

                  {obj.porcentagemDistribuicao > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg mb-4 border border-blue-500/30">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Auto-distribuição: {obj.porcentagemDistribuicao}%
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-white">{formatCurrency(Number(obj.valorAtual))}</span>
                      <span className="text-white/40 font-medium">{formatCurrency(Number(obj.valorAlvo))}</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#cbfb46] transition-all duration-1000 rounded-full" 
                        style={{ width: `${progresso}%` }} 
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-white/40">{progresso}% concluído</p>
                      <button 
                        onClick={() => { setSelectedGoal(obj); setShowDepositModal(true); }}
                        className="text-xs font-bold text-[#cbfb46] hover:text-[#b8e63e] transition-colors"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Objetivos Concluídos */}
      {concluidos.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Concluídos 🏆</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concluidos.map((obj) => (
              <div key={obj.id} className="bg-white/[0.03] backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full blur-3xl opacity-20"></div>
                <div className="relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-full font-bold">
                      Concluído
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{obj.titulo}</h3>
                  <p className="text-emerald-400 font-black text-xl">
                    {formatCurrency(Number(obj.valorAlvo))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#15191E] rounded-2xl w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">{editMode ? 'Editar Objetivo' : 'Novo Objetivo'}</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Título</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none"
                    value={formData.titulo}
                    onChange={e => setFormData({...formData, titulo: e.target.value})}
                    placeholder="Ex: Viagem para Dubai"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Valor Alvo (Kz)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none"
                      value={formData.valorAlvo}
                      onChange={e => setFormData({...formData, valorAlvo: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Data Prevista</label>
                    <input 
                      type="date" 
                      required
                      className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white focus:ring-1 focus:ring-[#cbfb46] outline-none [color-scheme:dark]"
                      value={formData.dataPrevista}
                      onChange={e => setFormData({...formData, dataPrevista: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Prioridade</label>
                    <select 
                      className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white focus:ring-1 focus:ring-[#cbfb46] outline-none appearance-none cursor-pointer"
                      value={formData.prioridade}
                      onChange={e => setFormData({...formData, prioridade: e.target.value})}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em'
                      }}
                    >
                      <option value="BAIXA">Baixa</option>
                      <option value="MEDIA">Média</option>
                      <option value="ALTA">Alta</option>
                      <option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Categoria</label>
                    <input 
                      type="text" 
                      className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none"
                      value={formData.categoria}
                      onChange={e => setFormData({...formData, categoria: e.target.value})}
                      placeholder="Ex: Viagem"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
                  <label className="block text-xs font-medium text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Distribuição Automática (%)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full bg-[#0B0E11] border border-blue-500/30 rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-blue-500 outline-none"
                    value={formData.porcentagemDistribuicao}
                    onChange={e => setFormData({...formData, porcentagemDistribuicao: e.target.value})}
                    placeholder="0"
                  />
                  <p className="text-xs text-blue-400/80 mt-2">
                    Percentagem das receitas que serão automaticamente direcionadas para este objetivo.
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="w-full h-12 bg-[#cbfb46] text-black rounded-xl font-bold hover:bg-[#b8e63e] transition-all shadow-[0_0_20px_rgba(203,251,70,0.2)]"
                >
                  {editMode ? 'Guardar Alterações' : 'Criar Objetivo'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Depósito */}
      {showDepositModal && selectedGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#15191E] rounded-2xl w-full max-w-sm shadow-2xl border border-white/10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Adicionar ao Objetivo</h3>
                <button 
                  onClick={() => setShowDepositModal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Quanto queres guardar para <strong className="text-white">{selectedGoal.titulo}</strong>?
              </p>
              <form onSubmit={handleQuickDeposit} className="space-y-4">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <input 
                    type="number" 
                    step="0.01"
                    autoFocus
                    placeholder="0.00" 
                    className="w-full pl-12 pr-4 py-4 bg-[#0B0E11] border-none rounded-xl text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] text-xl font-bold outline-none"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                  />
                </div>
                <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/30 text-xs text-yellow-400">
                  Nota: Isto criará uma despesa na conta selecionada e adicionará o valor ao objetivo.
                </div>
                <button 
                  type="submit" 
                  className="w-full h-12 bg-[#cbfb46] text-black rounded-xl font-bold hover:bg-[#b8e63e] transition-all shadow-[0_0_20px_rgba(203,251,70,0.2)]"
                >
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