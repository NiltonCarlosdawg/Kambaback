// src/components/Transactions.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowUp, Plus, Trophy, X } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Gasto, Cartao, Categoria, Objetivo } from '../types';
import { springBouncy, springSmooth } from './ui/animations/variants';

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  show: {
    opacity: 1,
    y: 0,
    transition: springSmooth,
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...springBouncy,
      delay: i * 0.05,
    },
  }),
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springBouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.2 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const SharedCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`rounded-2xl border shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', ...style }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
    <div>
      {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>{subtitle}</p>}
      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    {right}
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>{label}</label>
    {children}
  </div>
);

const inputSt: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 10, padding: '0 12px', fontSize: 14,
  color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms, box-shadow 150ms, background-color 150ms',
  backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)',
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [f, setF] = useState(false);
  return (
    <motion.input
      {...props}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e => { setF(false); props.onBlur?.(e); }}
      style={{ ...inputSt, ...(props.style || {}), border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-base)', boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none' }}
      animate={f ? { scale: 1.01 } : { scale: 1 }}
      transition={{ duration: 0.15 }}
    />
  );
};

const Sel: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  const [f, setF] = useState(false);
  return <select {...props}
    onFocus={e => { setF(true); props.onFocus?.(e); }} onBlur={e => { setF(false); props.onBlur?.(e); }}
    style={{ ...inputSt, ...(props.style || {}), appearance: 'none' as any, cursor: 'pointer', border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-base)', boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }} />;
};

const Pill: React.FC<{ label: string; color: string; bg: string; ring: string }> = ({ label, color, bg, ring }) => (
  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset"
    style={{ color, backgroundColor: bg, ringColor: ring }}>{label}</span>
);

const Transactions: React.FC = () => {
  const { formatMoney, maskValue, formatDate, prefs } = useTheme();

  const [transacoes, setTransacoes] = useState<Gasto[]>([]);
  const [cartoes,    setCartoes]    = useState<Cartao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [objetivos,  setObjetivos]  = useState<Objetivo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [error,      setError]      = useState('');
  const [filter,     setFilter]     = useState<'todos' | 'RECEITA' | 'DESPESA'>('todos');
  const [formData,   setFormData]   = useState({
    descricao: '', valor: '', tipo: 'DESPESA' as 'DESPESA' | 'RECEITA',
    cartaoId: '', categoriaId: '', objetivoId: '',
    data: new Date().toISOString().split('T')[0], local: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const [transRes, cardRes, catRes, objRes] = await Promise.all([
        api.get('/gastos'), api.get('/cartoes'), api.get('/categorias'), api.get('/objetivos'),
      ]);
      setTransacoes(transRes.data.gastos || []);
      setCartoes((cardRes.data.cartoes || []).filter((c: Cartao) => c.ativo && !c.excluido));
      setCategorias(catRes.data.categorias || []);
      setObjetivos(objRes.data.objetivos || []);
    } catch { setError('Falha ao carregar transações.'); }
    finally { setLoading(false); }
  };

  const categoriasFiltradas = useMemo(() => categorias.filter(c =>
    formData.tipo === 'DESPESA' ? ['ESSENCIAL', 'FLEXIVEL', 'POUPANCA'].includes(c.tipo) : c.tipo === 'RENDIMENTO'
  ), [categorias, formData.tipo]);

  const categoriasAgrupadas = useMemo(() => {
    const g: Record<string, Categoria[]> = {};
    categoriasFiltradas.forEach(c => { (g[c.tipo] = g[c.tipo] || []).push(c); });
    return g;
  }, [categoriasFiltradas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!formData.cartaoId)    { setError('Seleciona uma conta/cartão'); return; }
    if (!formData.categoriaId) { setError('Seleciona uma categoria'); return; }
    try {
      await api.post('/gastos', { ...formData, valor: parseFloat(formData.valor), data: new Date(formData.data).toISOString(), objetivoId: formData.tipo === 'DESPESA' && formData.objetivoId ? formData.objetivoId : undefined });
      setShowModal(false); fetchData();
      setFormData({ descricao: '', valor: '', tipo: 'DESPESA', cartaoId: '', categoriaId: '', objetivoId: '', data: new Date().toISOString().split('T')[0], local: '' });
    } catch (err: any) { setError(err.response?.data?.message || 'Erro ao guardar transação'); }
  };

  const filtered  = transacoes.filter(t => filter === 'todos' || t.tipo === filter);
  const totalRec  = transacoes.filter(t => t.tipo === 'RECEITA').reduce((a, t) => a + Number(t.valor), 0);
  const totalDesp = transacoes.filter(t => t.tipo === 'DESPESA').reduce((a, t) => a + Number(t.valor), 0);
  const saldo     = transacoes.reduce((a, t) => a + (t.tipo === 'RECEITA' ? Number(t.valor) : -Number(t.valor)), 0);
  const tipoNomes: Record<string, string> = { ESSENCIAL: 'Essenciais', FLEXIVEL: 'Flexíveis', POUPANCA: 'Poupança', RENDIMENTO: 'Rendimentos' };

  const kpiData = [
    { label: 'Total Receitas',    val: totalRec,  color: 'var(--accent)',                                  bg: 'var(--accent-10)',           ring: 'var(--accent-20)'           },
    { label: 'Total Despesas',    val: totalDesp, color: '#f87171',                                        bg: 'rgba(239,68,68,0.08)',        ring: 'rgba(239,68,68,0.2)'        },
    { label: 'Saldo do Período',  val: saldo,     color: saldo >= 0 ? 'var(--accent)' : '#f87171',        bg: saldo >= 0 ? 'var(--accent-10)' : 'rgba(239,68,68,0.08)', ring: saldo >= 0 ? 'var(--accent-20)' : 'rgba(239,68,68,0.2)' },
  ];

  return (
    <motion.div
      className="space-y-6 max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
        variants={headerVariants}
        initial="hidden"
        animate="show"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Finanças</p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Transações</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Gere as tuas receitas e despesas</p>
        </div>
        <motion.button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus size={18} />
          Nova Transação
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            className="flex items-center gap-3 p-3.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
          >
            <AlertCircle size={18} className="flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {kpiData.map(({ label, val, color, bg, ring }, index) => (
          <motion.div
            key={label}
            custom={index}
            variants={itemVariants}
            whileHover={{ y: -4, transition: springBouncy }}
          >
            <SharedCard style={{ padding: '20px 24px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>{label}</p>
              <motion.p
                className="text-2xl font-bold tracking-tight"
                style={{ color }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                {maskValue(formatMoney(val))}
              </motion.p>
            </SharedCard>
          </motion.div>
        ))}
      </motion.div>

      <LayoutGroup>
        <SharedCard style={{ padding: 6, display: 'inline-flex', gap: 4 }}>
          {(['todos', 'RECEITA', 'DESPESA'] as const).map((f, index) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{
                backgroundColor: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? 'var(--accent-text)' : 'var(--text-muted)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.span
                layoutId={`filter-${f}`}
                style={{ display: 'inline-block' }}
              >
                {f === 'todos' ? 'Todos' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}
              </motion.span>
            </motion.button>
          ))}
        </SharedCard>
      </LayoutGroup>

      <SharedCard style={{ overflow: 'hidden' }}>
        <SectionHeader title="Movimentos" subtitle={`${filtered.length} registos`} />
        {loading ? (
          <motion.div
            className="p-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-2"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>A carregar…</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            className="p-16 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowDown size={32} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            </motion.div>
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Sem transações registadas.</p>
          </motion.div>
        ) : (
          <motion.div layout>
            <AnimatePresence mode="popLayout">
              {filtered.map((t, index) => {
                const isReceita = t.tipo === 'RECEITA', valor = Number(t.valor);
                return (
                  <motion.div
                    key={t.id}
                    layout
                    className="px-5 py-4 flex items-center justify-between group"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{
                      ...springSmooth,
                      delay: index * 0.03,
                    }}
                    whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <motion.div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset"
                        style={{
                          backgroundColor: isReceita ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          ringColor: isReceita ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                          color: isReceita ? '#10b981' : '#f87171',
                        }}
                        whileHover={{ scale: 1.1 }}
                      >
                        {isReceita ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      </motion.div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.descricao || 'Sem descrição'}</p>
                          <AnimatePresence>
                            {t.distribuicaoAutomatica && (
                              <motion.span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                                style={{ color: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.08)', ringColor: 'rgba(59,130,246,0.2)' }}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                              >
                                Auto
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <AnimatePresence>
                            {(t as any).objetivo && (
                              <motion.span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset flex items-center gap-1"
                                style={{ color: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.08)', ringColor: 'rgba(139,92,246,0.2)' }}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                              >
                                <Trophy size={10} /> {(t as any).objetivo.titulo}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] mt-0.5 flex-wrap" style={{ color: 'var(--text-faint)' }}>
                          <span>{formatDate(t.data)}</span>
                          <span>·</span>
                          <span>{(t as any).cartao?.nome || 'Conta removida'}</span>
                          <span>·</span>
                          <span className="rounded-full px-2 py-0.5 ring-1 ring-inset text-[10px] font-semibold"
                            style={{ backgroundColor: 'var(--bg-elevated)', ringColor: 'var(--border)', color: 'var(--text-faint)' }}>
                            {t.categoria?.nome || 'Geral'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <motion.span
                      className="text-sm font-bold flex-shrink-0 ml-4"
                      style={{ color: isReceita ? '#10b981' : 'var(--text-primary)' }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 + 0.1 }}
                    >
                      {isReceita ? '+' : '-'}{maskValue(formatMoney(valor))}
                    </motion.span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </SharedCard>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-inset"
                    style={{ backgroundColor: 'var(--accent-10)', ringColor: 'var(--accent-20)' }}>
                    <Plus size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Registar Movimento</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Preenche os dados do movimento</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ color: 'var(--text-faint)' }}
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={20} />
                </motion.button>
              </div>

              <motion.form
                onSubmit={handleSubmit}
                className="p-5 space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="grid grid-cols-2 gap-3">
                  {(['DESPESA', 'RECEITA'] as const).map((tipo, index) => {
                    const active = formData.tipo === tipo, isRec = tipo === 'RECEITA';
                    return (
                      <motion.button
                        key={tipo}
                        type="button"
                        onClick={() => setFormData({ ...formData, tipo, objetivoId: '', categoriaId: '' })}
                        className="p-3.5 rounded-xl text-center border ring-1 ring-inset"
                        style={{
                          borderColor: active ? (isRec ? 'var(--accent)' : 'rgba(239,68,68,0.4)') : 'var(--border)',
                          backgroundColor: active ? (isRec ? 'var(--accent-10)' : 'rgba(239,68,68,0.08)') : 'var(--bg-base)',
                          color: active ? (isRec ? 'var(--accent)' : '#f87171') : 'var(--text-faint)',
                          ringColor: active ? (isRec ? 'var(--accent-20)' : 'rgba(239,68,68,0.2)') : 'transparent',
                          fontWeight: active ? 700 : 400,
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex justify-center mb-1.5">
                          {isRec ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                        </div>
                        <span className="text-xs">{isRec ? 'Receita' : 'Despesa'}</span>
                      </motion.button>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Field label="Valor (Kz) *">
                    <Input type="number" required min="0.01" step="0.01" placeholder="0.00"
                      value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} />
                  </Field>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Field label="Descrição *">
                    <Input type="text" required placeholder="Ex: Compra de supermercado"
                      value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
                  </Field>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Field label="Categoria *">
                    <Sel required value={formData.categoriaId} onChange={e => setFormData({ ...formData, categoriaId: e.target.value })}>
                      <option value="">Selecionar…</option>
                      {Object.keys(categoriasAgrupadas).map(tipo => (
                        <optgroup key={tipo} label={tipoNomes[tipo]}>
                          {categoriasAgrupadas[tipo].map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </optgroup>
                      ))}
                    </Sel>
                  </Field>
                  <Field label="Data *">
                    <Input type="date" required value={formData.data}
                      onChange={e => setFormData({ ...formData, data: e.target.value })} />
                  </Field>
                </motion.div>

                <AnimatePresence>
                  {formData.tipo === 'DESPESA' && (
                    <motion.div
                      className="p-4 rounded-xl border ring-1 ring-inset space-y-2.5"
                      style={{ backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)', ringColor: 'rgba(139,92,246,0.1)' }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#a78bfa' }}>
                        <Trophy size={14} /> Guardar neste Objetivo (Opcional)
                      </label>
                      <Sel value={formData.objetivoId} onChange={e => setFormData({ ...formData, objetivoId: e.target.value })}>
                        <option value="">Nenhum (despesa normal)</option>
                        {objetivos.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                      </Sel>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Field label="Conta / Cartão *">
                    <Sel required value={formData.cartaoId} onChange={e => setFormData({ ...formData, cartaoId: e.target.value })}>
                      <option value="">Selecionar…</option>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome} (Disp: {formatMoney(Number((c as any).saldoDisponivel || c.saldoAtual))})</option>)}
                    </Sel>
                  </Field>
                </motion.div>

                <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-11 rounded-xl text-sm font-medium border"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', backgroundColor: 'transparent' }}
                    whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="flex-1 h-11 rounded-xl text-sm font-bold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
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
