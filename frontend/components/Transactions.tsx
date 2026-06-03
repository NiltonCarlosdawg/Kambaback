// src/components/Transactions.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowUp, Plus, Trophy, X, Filter, Search, Calendar, Tag, CreditCard, Loader2, Trash2, CheckCircle2, ChevronDown, Download, RefreshCcw } from 'lucide-react';
import transactionsService from '../services/transactionsService';
import categoriesService from '../services/categoriesService';
import cardsService from '../services/cardsService';
import goalsService from '../services/goalsService';
import { Gasto, Categoria, Cartao, Objetivo } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

// ─── Sub-components ──────────────────────────────────────────────────────────

const TransactionRow: React.FC<{ 
  transaction: Gasto; 
  onDelete: (id: string) => void;
  index: number;
}> = ({ transaction, onDelete, index }) => {
  const { formatDate, formatMoney, maskValue } = useTheme();
  const isExpense = transaction.tipo === 'DESPESA';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...springSmooth, delay: index * 0.03 }}
      className="group flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-white/[0.02]"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpense ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {isExpense ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{transaction.descricao}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" 
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>
              {transaction.categoria?.nome || 'Geral'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{formatDate(transaction.data)}</span>
            {transaction.cartao && (
              <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                <CreditCard size={10} /> {transaction.cartao.nome}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 ml-4">
        <div className="text-right">
          <p className={`font-black text-sm ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
            {isExpense ? '-' : '+'}{maskValue(formatMoney(Number(transaction.valor)))}
          </p>
          {transaction.objetivo && (
            <p className="text-[10px] font-medium flex items-center gap-1 justify-end" style={{ color: 'var(--accent)' }}>
              <Trophy size={10} /> {transaction.objetivo.titulo}
            </p>
          )}
          {transaction.distribuicaoAutomatica && (
            <p className="text-[10px] font-medium flex items-center gap-1 justify-end text-emerald-400">
              <CheckCircle2 size={10} /> Distribuição automática
            </p>
          )}
        </div>
        
        <button 
          onClick={() => onDelete(transaction.id)}
          className="p-2 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10"
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Transactions: React.FC = () => {
  const { maskValue, formatMoney } = useTheme();
  
  const [transactions, setTransactions] = useState<Gasto[]>([]);
  const [categories,   setCategories]   = useState<Categoria[]>([]);
  const [cards,        setCards]        = useState<Cartao[]>([]);
  const [goals,        setGoals]        = useState<Objetivo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [error,        setError]        = useState('');
  
  // Filters
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState<'TODOS' | 'DESPESA' | 'RECEITA'>('TODOS');
  
  // Form State
  const [formData, setFormData] = useState({
    descricao: '', valor: '', tipo: 'DESPESA', data: new Date().toISOString().split('T')[0],
    categoriaId: '', cartaoId: '', objetivoId: ''
  });

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [tRes, cRes, cardRes] = await Promise.all([
        transactionsService.listar(),
        categoriesService.listar(),
        cardsService.listar()
      ]);
      
      setTransactions(tRes.gastos || tRes.transacoes || []);
      setCategories(cRes.categorias || []);
      setCards(cardRes.cartoes || []);
      try {
        const gRes = await goalsService.listar();
        setGoals(gRes.objetivos || []);
      } catch {
        setGoals([]);
      }
    } catch { setError('Falha ao sincronizar transações.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta transação permanentemente?')) return;
    try {
      await transactionsService.remover(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch { alert('Erro ao eliminar transação.'); }
  };

  const openTransactionForm = () => {
    setError('');
    setFormData({
      descricao: '',
      valor: '',
      tipo: 'DESPESA',
      data: new Date().toISOString().split('T')[0],
      categoriaId: '',
      cartaoId: '',
      objetivoId: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao || !formData.valor) return;

    if (!formData.cartaoId) {
      setError('Escolhe uma conta/cartão para registar a transação.');
      return;
    }

    if (!formData.categoriaId) {
      setError('Escolhe uma categoria para registar a transação.');
      return;
    }

    if (formData.tipo === 'RECEITA' && selectedCard?.distribuirParaObjetivos) {
      if (selectedCardDistributionPercent <= 0) {
        setError('O cartão selecionado está com distribuição automática activa, mas sem percentagem configurada.');
        return;
      }

      if (distributionGoals.length === 0) {
        setError('Ativa percentagens nos objetivos para usar a distribuição automática.');
        return;
      }

      if (Math.abs(distributionTotal - 100) > 0.01) {
        setError(`A soma das percentagens dos objetivos está em ${distributionTotal.toFixed(2)}%. Ajusta a distribuição na tela de objetivos para fechar 100%.`);
        return;
      }
    }
    
    try {
      setError('');
      await transactionsService.criar({
        descricao: formData.descricao,
        valor: Number(formData.valor),
        tipo: formData.tipo,
        data: new Date(formData.data).toISOString(),
        cartaoId: formData.cartaoId,
        categoriaId: formData.categoriaId,
        objetivoId: formData.tipo === 'DESPESA' ? (formData.objetivoId || null) : null,
      });
      setShowForm(false);
      setFormData({ descricao: '', valor: '', tipo: 'DESPESA', data: new Date().toISOString().split('T')[0], categoriaId: '', cartaoId: '', objetivoId: '' });
      fetchData(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao registar transação.');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.descricao.toLowerCase().includes(search.toLowerCase());
      const matchType   = typeFilter === 'TODOS' || t.tipo === typeFilter;
      return matchSearch && matchType;
    });
  }, [transactions, search, typeFilter]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const v = Number(t.valor);
      if (t.tipo === 'RECEITA') acc.receitas += v;
      else acc.despesas += v;
      return acc;
    }, { receitas: 0, despesas: 0 });
  }, [filteredTransactions]);

  const activeGoals = useMemo(
    () => goals.filter(goal => !goal.concluido),
    [goals],
  );

  const distributionGoals = useMemo(
    () => activeGoals.filter(goal => Number(goal.porcentagemDistribuicao || 0) > 0),
    [activeGoals],
  );

  const distributionTotal = useMemo(
    () => distributionGoals.reduce((acc, goal) => acc + Number(goal.porcentagemDistribuicao || 0), 0),
    [distributionGoals],
  );

  const selectedCard = useMemo(
    () => cards.find(card => card.id === formData.cartaoId) || null,
    [cards, formData.cartaoId],
  );

  const selectedCardDistributionPercent = Number(selectedCard?.percentualDistribuicaoPoupanca || 0);
  const selectedCardAutoDistribution = Boolean(selectedCard?.distribuirParaObjetivos && selectedCardDistributionPercent > 0);

  if (loading) return (
    <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Carregando as tuas movimentações…</p>
    </div>
  );

  return (
    <motion.div className="max-w-5xl mx-auto space-y-6 pb-20"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Transações</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Fica de olho em cada kwanza que entra e sai.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="p-2.5 rounded-xl border transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={openTransactionForm}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-accent/20"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
            <Plus size={18} />
            Novo Registo
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Total Entradas</p>
          <p className="text-2xl font-black mt-1 text-emerald-400">+{maskValue(formatMoney(totals.receitas))}</p>
        </div>
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Total Saídas</p>
          <p className="text-2xl font-black mt-1 text-red-400">-{maskValue(formatMoney(totals.despesas))}</p>
        </div>
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Balanço Líquido</p>
          <p className={`text-2xl font-black mt-1 ${totals.receitas >= totals.despesas ? 'text-blue-400' : 'text-amber-400'}`}>
            {maskValue(formatMoney(totals.receitas - totals.despesas))}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border bg-white/[0.01]" style={{ borderColor: 'var(--border)' }}>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
          <input 
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Procurar descrição…"
            className="w-full pl-10 pr-4 py-2 rounded-xl outline-none text-sm transition-all"
            style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        <div className="flex gap-2">
          {(['TODOS', 'DESPESA', 'RECEITA'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-4 py-2 rounded-xl text-xs font-bold border transition-all"
              style={{ 
                backgroundColor: typeFilter === t ? 'var(--accent)' : 'var(--bg-base)', 
                borderColor: typeFilter === t ? 'var(--accent)' : 'var(--border)',
                color: typeFilter === t ? 'var(--accent-text)' : 'var(--text-muted)'
              }}>
              {t === 'TODOS' ? 'Todos' : t === 'DESPESA' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {filteredTransactions.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-20 text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-3xl bg-white/[0.03] flex items-center justify-center mx-auto border border-white/5">
                  <Search size={28} style={{ color: 'var(--text-faint)' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Sem transações encontradas</h3>
                  <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Tenta ajustar os filtros ou a tua pesquisa.</p>
                </div>
              </motion.div>
            ) : (
              filteredTransactions.map((t, i) => (
                <TransactionRow key={t.id} transaction={t} onDelete={handleDelete} index={i} />
              ))
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            
            <motion.div
              layoutId="form-container"
              className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl border"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Novo Registo</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-faint)' }}>
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <motion.form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex p-1 rounded-xl bg-white/[0.03] border" style={{ borderColor: 'var(--border)' }}>
                  {(['DESPESA', 'RECEITA'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setFormData({
                      ...formData,
                      tipo: t,
                      objetivoId: t === 'DESPESA' ? formData.objetivoId : '',
                    })}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ 
                        backgroundColor: formData.tipo === t ? (t === 'DESPESA' ? '#ef4444' : '#10b981') : 'transparent',
                        color: formData.tipo === t ? '#fff' : 'var(--text-faint)'
                      }}>
                      {t === 'DESPESA' ? 'Saída (Gasto)' : 'Entrada (Receita)'}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Descrição</label>
                  <input 
                    type="text" required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})}
                    placeholder="O que pagaste ou recebeste?"
                    className="w-full px-4 py-3 rounded-xl outline-none border transition-all"
                    style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Valor (Kz)</label>
                    <input 
                      type="number" required value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})}
                      placeholder="0,00"
                      className="w-full px-4 py-3 rounded-xl outline-none border transition-all font-mono font-bold"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Data</label>
                    <input 
                      type="date" required value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none border transition-all"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Categoria</label>
                    <select 
                      value={formData.categoriaId} onChange={e => setFormData({...formData, categoriaId: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none border appearance-none"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Seleccionar…</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Conta / Cartão</label>
                    <select 
                      value={formData.cartaoId} onChange={e => setFormData({...formData, cartaoId: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none border appearance-none"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Seleccionar…</option>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>

                {formData.tipo === 'DESPESA' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Destino do valor</label>
                    <select
                      value={formData.objetivoId}
                      onChange={e => setFormData({...formData, objetivoId: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none border appearance-none"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Nenhum objetivo</option>
                      {activeGoals.map(goal => (
                        <option key={goal.id} value={goal.id}>
                          {goal.titulo} - {Number(goal.porcentagemDistribuicao || 0)}%
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      Esta despesa será registada e, se escolheres um objetivo, o valor entra nele como depósito manual.
                    </p>
                    {activeGoals.length === 0 && (
                      <p className="text-[11px] text-amber-400">
                        Ainda não tens objetivos activos. Cria um objetivo na tela de Objetivos para usar este destino.
                      </p>
                    )}
                  </div>
                )}

                {formData.tipo === 'RECEITA' && (
                  <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.18)' }}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Distribuição automática</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                          A distribuição é controlada pelo cartão selecionado. Se o cartão estiver activo para poupança, a receita será repartida pelos objetivos configurados.
                        </p>
                      </div>
                    </div>

                    {selectedCard?.distribuirParaObjetivos ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                          Cartão seleccionado: {selectedCard?.nome || 'Cartão selecionado'}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {selectedCardDistributionPercent}% da receita vai para a pool de objetivos.
                        </p>
                        <p className="text-[11px]" style={{ color: selectedCardAutoDistribution ? '#4ade80' : '#f87171' }}>
                          {selectedCardAutoDistribution
                            ? 'Distribuição automática activa para este cartão.'
                            : 'A opção está activa, mas a percentagem precisa de ser maior que zero.'}
                        </p>
                        <div className="rounded-xl border px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}>
                          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                            Objetivos activos com distribuição: {distributionGoals.length} · Total {distributionTotal.toFixed(2)}%
                          </p>
                          {distributionGoals.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {distributionGoals.map((goal) => (
                                <span key={goal.id} className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                                  {goal.titulo} {Number(goal.porcentagemDistribuicao || 0)}%
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {Math.abs(distributionTotal - 100) > 0.01 && (
                          <div className="rounded-xl border px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                            A soma das percentagens dos objetivos está em {distributionTotal.toFixed(2)}%. Ajusta os valores na tela de objetivos para a distribuição automática funcionar.
                          </div>
                        )}
                        {selectedCardDistributionPercent <= 0 && (
                          <div className="rounded-xl border px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                            Este cartão tem a opção activa, mas a percentagem está em 0%. Define um valor maior que zero na tela de cartões.
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        Selecciona um cartão com a opção de distribuição automática activada na carteira para usar esta funcionalidade.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl font-bold border transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
                    Cancelar
                  </button>
                  <motion.button type="submit"
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 rounded-xl font-black shadow-lg shadow-accent/20"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                    Guardar
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Transactions;
