// src/components/Goals.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { Objetivo } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

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
      delay: i * 0.08,
    },
  }),
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  show: {
    opacity: 1,
    y: 0,
    transition: springSmooth,
  },
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

const progressVariants = {
  hidden: { width: 0 },
  show: (progresso: number) => ({
    width: `${progresso}%`,
    transition: {
      ...springSmooth,
      delay: 0.3,
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  }),
};

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

  const inp: React.CSSProperties = { width: '100%', height: 48, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'box-shadow 200ms' };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' };
  const fa = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 1px var(--accent)'; };
  const fb = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; };

  if (loading) return (
    <motion.div
      className="flex h-full items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Carregando objetivos…</p>
      </div>
    </motion.div>
  );

  const kpiData = resumo ? [
    { label: 'Objetivos Ativos',  value: resumo.totalObjetivos, color: 'var(--text-primary)', bg: 'from-purple-500 to-purple-600' },
    { label: 'Total Acumulado',   value: maskValue(formatMoney(Number(resumo.totalAtual))), color: 'var(--accent)', bg: 'from-green-500 to-emerald-600' },
    { label: 'Meta Total',        value: maskValue(formatMoney(Number(resumo.totalAlvo))), color: 'var(--text-primary)', bg: 'from-blue-500 to-indigo-600' },
    { label: 'Progresso Geral',   value: `${resumo.progressoGeral}%`, color: '#34d399', bg: 'from-emerald-500 to-green-600' },
  ] : [];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {resumo && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {kpiData.map(({ label, value, color, bg }, index) => (
            <motion.div
              key={label}
              custom={index}
              variants={itemVariants}
              whileHover={{ y: -4, transition: springBouncy }}
              className="relative overflow-hidden group"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
            >
              <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${bg} rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity`} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-4xl font-black" style={{ color }}>{value}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        variants={headerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-10)' }}
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={springBouncy}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </motion.div>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Planeia e alcança as tuas metas</p>
        </div>
        <motion.button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo Objetivo
        </motion.button>
      </motion.div>

      <div className="space-y-6">
        <motion.h2
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Em Progresso
        </motion.h2>

        {objetivos.length === 0 ? (
          <motion.div
            className="p-12 text-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex flex-col items-center gap-4">
              <motion.div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </motion.div>
              <div>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Nenhum objetivo ativo</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>Cria o teu primeiro objetivo financeiro</p>
                <motion.button
                  onClick={() => handleOpenModal()}
                  className="inline-flex items-center gap-2 font-medium text-sm"
                  style={{ color: 'var(--accent)' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Criar objetivo
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {objetivos.map((obj, index) => {
              const progresso = Math.min(Math.round((Number(obj.valorAtual) / Number(obj.valorAlvo)) * 100), 100);
              const pc = prioridadeColors[obj.prioridade] || prioridadeColors.BAIXA;
              const daysLeft = getDaysRemaining(obj.dataPrevista);
              return (
                <motion.div
                  key={obj.id}
                  custom={index}
                  variants={itemVariants}
                  whileHover={{ y: -6, scale: 1.01, transition: springBouncy }}
                  className="p-6 group"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '1rem' }}
                  layout
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent-10)' }}
                        whileHover={{ rotate: 15, scale: 1.1 }}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </motion.div>
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</h3>
                        {obj.categoria && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{obj.categoria}</span>}
                      </div>
                    </div>
                    <motion.div
                      className="flex gap-1"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                    >
                      <motion.button
                        onClick={() => handleOpenModal(obj)}
                        className="p-2 rounded-lg text-blue-400"
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(59,130,246,0.2)' }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(obj.id)}
                        className="p-2 rounded-lg text-red-400"
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(239,68,68,0.2)' }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </motion.button>
                    </motion.div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <motion.span
                      className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
                      animate={obj.prioridade === 'URGENTE' ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {obj.prioridade}
                    </motion.span>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{daysLeft}d restantes</span>
                    )}
                  </div>
                  {obj.porcentagemDistribuicao > 0 && (
                    <motion.div
                      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg mb-4"
                      style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Auto-distribuição: {obj.porcentagemDistribuicao}%
                    </motion.div>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(Number(obj.valorAtual)))}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{maskValue(formatMoney(Number(obj.valorAlvo)))}</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: 'var(--accent)' }}
                        custom={progresso}
                        variants={progressVariants}
                        initial="hidden"
                        animate="show"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <motion.p
                        className="text-xs"
                        style={{ color: 'var(--text-faint)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        {progresso}% concluído
                      </motion.p>
                      <motion.button
                        onClick={() => { setSelectedGoal(obj); setShowDepositModal(true); }}
                        className="text-xs font-bold"
                        style={{ color: 'var(--accent)' }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        + Adicionar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {concluidos.length > 0 && (
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.h2
            className="text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Concluídos 🏆
          </motion.h2>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {concluidos.map((obj, index) => (
              <motion.div
                key={obj.id}
                custom={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02, transition: springBouncy }}
                className="p-6 rounded-2xl relative overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full blur-3xl opacity-20" />
                <div className="relative flex justify-between items-start mb-4">
                  <motion.div
                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/20"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  </motion.div>
                  <motion.span
                    className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-full font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: index * 0.1 }}
                  >
                    Concluído
                  </motion.span>
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</h3>
                <p className="text-emerald-400 font-black text-xl">{maskValue(formatMoney(Number(obj.valorAlvo)))}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 z-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editMode ? 'Editar Objetivo' : 'Novo Objetivo'}</h3>
                  <motion.button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-lg"
                    style={{ color: 'var(--text-faint)' }}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </motion.button>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="mb-4 p-3 rounded-lg text-sm text-red-400 bg-red-900/20 border border-red-500/30"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Título</label>
                    <motion.input
                      type="text"
                      required
                      placeholder="Ex: Viagem para Dubai"
                      value={formData.titulo}
                      onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                      style={inp}
                      onFocus={fa}
                      onBlur={fb}
                      whileFocus={{ scale: 1.01 }}
                    />
                  </motion.div>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Valor Alvo (Kz)</label>
                      <input type="number" step="0.01" required placeholder="0.00" value={formData.valorAlvo} onChange={e => setFormData({ ...formData, valorAlvo: e.target.value })} style={inp} onFocus={fa} onBlur={fb} />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Data Prevista</label>
                      <input type="date" required value={formData.dataPrevista} onChange={e => setFormData({ ...formData, dataPrevista: e.target.value })} style={{ ...inp, colorScheme: 'dark' } as any} onFocus={fa} onBlur={fb} />
                    </motion.div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Prioridade</label>
                      <select value={formData.prioridade} onChange={e => setFormData({ ...formData, prioridade: e.target.value })} style={sel} onFocus={fa} onBlur={fb}>
                        <option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option>
                      </select>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Categoria</label>
                      <input type="text" placeholder="Ex: Viagem" value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} style={inp} onFocus={fa} onBlur={fb} />
                    </motion.div>
                  </div>
                  <motion.div
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Distribuição Automática (%)
                    </label>
                    <input type="number" min="0" max="100" step="0.01" placeholder="0" value={formData.porcentagemDistribuicao} onChange={e => setFormData({ ...formData, porcentagemDistribuicao: e.target.value })} style={{ ...inp, border: '1px solid rgba(59,130,246,0.3)' }} onFocus={e => { e.target.style.boxShadow = '0 0 0 1px #3b82f6'; }} onBlur={fb} />
                    <p className="text-xs text-blue-400/80 mt-2">Percentagem das receitas direcionadas automaticamente para este objetivo.</p>
                  </motion.div>
                  <motion.button
                    type="submit"
                    className="w-full h-12 rounded-xl font-bold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {editMode ? 'Guardar Alterações' : 'Criar Objetivo'}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDepositModal && selectedGoal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 z-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setShowDepositModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-2xl shadow-2xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Adicionar ao Objetivo</h3>
                  <motion.button
                    onClick={() => setShowDepositModal(false)}
                    className="p-2 rounded-lg"
                    style={{ color: 'var(--text-faint)' }}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </motion.button>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Quanto queres guardar para <strong style={{ color: 'var(--text-primary)' }}>{selectedGoal.titulo}</strong>?</p>
                <form onSubmit={handleQuickDeposit} className="space-y-4">
                  <div className="relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <motion.input
                      type="number"
                      step="0.01"
                      autoFocus
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      style={{ ...inp, paddingLeft: 48, height: 56, fontSize: 20, fontWeight: 700 }}
                      onFocus={fa}
                      onBlur={fb}
                      whileFocus={{ scale: 1.02 }}
                    />
                  </div>
                  <div className="p-3 rounded-lg text-xs text-yellow-400" style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                    Nota: Isto criará uma despesa na conta selecionada e adicionará o valor ao objetivo.
                  </div>
                  <motion.button
                    type="submit"
                    className="w-full h-12 rounded-xl font-bold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Confirmar Depósito
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Goals;
