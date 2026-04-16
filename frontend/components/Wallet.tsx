// src/components/Wallet.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CreditCard, Plus, Save, ShieldCheck, X } from 'lucide-react';
import api from '../services/api';
import { Cartao } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

interface FundoStatus {
  existe: boolean; ativo: boolean;
  fundo?: { id: string; nome: string; saldoAtual: number; saldoDisponivel: number };
  metricas?: { despesaMediaMensal: number; alvoEmergencia: number; mesesCobertos: number; percentualAtingido: number; mesesRecomendados: number };
  depositoMinimoAtivacao: number;
}

const MINIMO_ATIVACAO = 100_000;

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
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
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: springBouncy },
  tap: { scale: 0.95 },
};

const progressVariants = {
  hidden: { width: 0 },
  show: {
    width: '100%',
    transition: { ...springSmooth, delay: 0.3 },
  },
};

const SharedCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void; motionProps?: any }> = ({ children, className = '', style, onClick, motionProps }) => (
  <motion.div
    className={`rounded-2xl border shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', ...style }}
    onClick={onClick}
    {...motionProps}
  >
    {children}
  </motion.div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>{label}</label>
    {children}
    {hint && <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>{hint}</p>}
  </div>
);

const inputSt: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 10, padding: '0 12px', fontSize: 14,
  color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms, box-shadow 150ms, background-color 150ms',
  backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)',
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { animate?: boolean }> = (props) => {
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

const getGradient = (tipo: string) => ({
  DEBITO:  'from-orange-500 to-orange-700',
  CREDITO: 'from-blue-600 to-indigo-800',
  POUPANCA:'from-emerald-500 to-green-700',
}[tipo] ?? 'from-zinc-600 to-zinc-800');

const Wallet: React.FC = () => {
  const { formatMoney, maskValue } = useTheme();

  const [cartoes,        setCartoes]        = useState<Cartao[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [error,          setError]          = useState('');
  const [fundo,          setFundo]          = useState<FundoStatus | null>(null);
  const [showFundoModal, setShowFundoModal] = useState(false);
  const [fundoLoading,   setFundoLoading]   = useState(false);
  const [fundoError,     setFundoError]     = useState('');
  const [depositoValor,  setDepositoValor]  = useState('');
  const [cartaoOrigemId, setCartaoOrigemId] = useState('');
  const [formData, setFormData] = useState({
    nome: '', tipo: 'DEBITO' as 'DEBITO' | 'CREDITO' | 'POUPANCA',
    banco: '', saldoAtual: '', limiteCredito: '',
    diaFechamento: '', diaVencimento: '', distribuirParaObjetivos: false,
  });

  useEffect(() => { fetchCards(); fetchFundo(); }, []);

  const fetchCards = async () => { try { const { data } = await api.get('/cartoes'); setCartoes(data.cartoes || []); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const fetchFundo = async () => { try { const { data } = await api.get('/fundo-emergencia'); setFundo(data); } catch (e) { console.error(e); } };
  const abrirFundoModal = () => { setFundoError(''); setDepositoValor(''); setCartaoOrigemId(''); setShowFundoModal(true); };

  const handleDepositar = async () => {
    const valor = parseFloat(depositoValor);
    if (!valor || valor <= 0) { setFundoError('Insere um valor válido.'); return; }
    if (!cartaoOrigemId) { setFundoError('Selecciona o cartão de origem.'); return; }
    setFundoLoading(true); setFundoError('');
    try {
      if (!fundo?.existe) await api.post('/fundo-emergencia').catch(e => { if (e.response?.status !== 409) throw e; });
      await api.post('/fundo-emergencia/depositar', { cartaoOrigemId, valor });
      await Promise.all([fetchFundo(), fetchCards()]);
      setShowFundoModal(false);
    } catch (err: any) { setFundoError(err.response?.data?.message || 'Erro ao processar depósito.'); }
    finally { setFundoLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const payload: any = { nome: formData.nome, tipo: formData.tipo, banco: formData.banco || undefined, distribuirParaObjetivos: formData.distribuirParaObjetivos };
      if (formData.tipo === 'CREDITO') { payload.limiteCredito = parseFloat(formData.limiteCredito); payload.diaFechamento = parseInt(formData.diaFechamento); payload.diaVencimento = parseInt(formData.diaVencimento); }
      else { payload.saldoAtual = parseFloat(formData.saldoAtual); }
      await api.post('/cartoes', payload);
      setShowModal(false); fetchCards(); resetForm();
    } catch (err: any) { setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.mensagem || 'Erro ao adicionar cartão'); }
  };

  const resetForm = () => setFormData({ nome: '', tipo: 'DEBITO', banco: '', saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: '', distribuirParaObjetivos: false });
  const toggleDistribuicao = async (card: Cartao) => { try { await api.patch(`/cartoes/${card.id}`, { distribuirParaObjetivos: !card.distribuirParaObjetivos }); fetchCards(); } catch (e) { console.error(e); } };

  const cartoesElegiveis = cartoes.filter(c => c.tipo !== 'CREDITO' && !(c as any).isFundoEmergencia);
  const fundoAtivo = fundo?.ativo ?? false;
  const fundoSaldo = fundo?.fundo?.saldoAtual ?? 0;
  const fundoMetricas = fundo?.metricas;
  const pctParaAtivo = Math.min(100, Math.round((fundoSaldo / MINIMO_ATIVACAO) * 100));

  if (loading) return (
    <motion.div
      className="flex h-full items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>A carregar carteira…</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        variants={headerVariants}
        initial="hidden"
        animate="show"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Finanças</p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Carteira</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Gere os teus cartões e contas bancárias</p>
        </div>
        <motion.button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          <Plus size={18} />
          Adicionar Conta
        </motion.button>
      </motion.div>

      {cartoes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springBouncy}
        >
          <SharedCard style={{ padding: '64px 24px', textAlign: 'center' }}>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <CreditCard size={40} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            </motion.div>
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Nenhum cartão adicionado</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>Adiciona a tua primeira conta para começar</p>
            <motion.button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--accent)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={16} /> Adicionar Conta
            </motion.button>
          </SharedCard>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {cartoes.map((card, index) => (
            <motion.div
              key={card.id}
              className="relative overflow-hidden rounded-2xl text-white shadow-lg"
              custom={index}
              variants={cardVariants}
              whileHover={{
                y: -8,
                scale: 1.02,
                transition: { ...springBouncy, stiffness: 400 },
              }}
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${getGradient(card.tipo)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.2 }}
              />
              <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10 p-5 flex flex-col justify-between min-h-[210px]">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white/70 text-[11px] font-medium mb-0.5">{card.banco || 'KwanzaPro'}</p>
                    <h3 className="text-base font-bold mb-2">{card.nome}</h3>
                    <span className="inline-block px-2 py-0.5 bg-white/20 rounded-full text-[10px] uppercase font-bold tracking-wider">
                      {card.tipo === 'DEBITO' ? 'Débito' : card.tipo === 'CREDITO' ? 'Crédito' : 'Poupança'}
                    </span>
                  </div>
                  {card.tipo === 'DEBITO'   && <CreditCard   size={22} className="text-white/70 flex-shrink-0" />}
                  {card.tipo === 'CREDITO'  && <CreditCard   size={22} className="text-white/70 flex-shrink-0" />}
                  {card.tipo === 'POUPANCA' && <Save   size={22} className="text-white/70 flex-shrink-0" />}
                </div>
                <div className="mt-5 space-y-1.5">
                  {card.tipo === 'CREDITO' ? (
                    <>
                      <p className="text-white/60 text-[11px]">Fatura Atual</p>
                      <p className="text-2xl font-bold">{maskValue(formatMoney(Number(card.saldoAtual)))}</p>
                      <div className="flex justify-between text-[11px] text-white/70 pt-2.5 border-t border-white/20">
                        <span>Limite: {maskValue(formatMoney(Number(card.limiteCredito || 0)))}</span>
                        <span className="text-green-200 font-semibold">Disp: {maskValue(formatMoney(Number(card.saldoDisponivel || 0)))}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 text-[11px]">Saldo Atual</p>
                      <p className="text-2xl font-bold">{maskValue(formatMoney(Number(card.saldoAtual)))}</p>
                      <div className="flex justify-between text-[11px] text-white/70 pt-2.5 border-t border-white/20">
                        <span>Disponível: {maskValue(formatMoney(Number(card.saldoDisponivel || 0)))}</span>
                        {Number(card.saldoReservado || 0) > 0 && <span className="text-yellow-200">Res: {maskValue(formatMoney(Number(card.saldoReservado)))}</span>}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-white/20">
                  <motion.button
                    onClick={() => toggleDistribuicao(card)}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    transition={{ duration: 0.15 }}
                  >
                    <span className="text-[11px] text-white/70 font-medium">Distribuição {card.distribuirParaObjetivos ? 'Ativa' : 'Inativa'}</span>
                    <motion.div
                      className="w-9 h-5 rounded-full"
                      style={{ backgroundColor: card.distribuirParaObjetivos ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)' }}
                      animate={{ backgroundColor: card.distribuirParaObjetivos ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)' }}
                    >
                      <motion.div
                        className="w-3.5 h-3.5 rounded-full bg-white shadow mt-0.5"
                        animate={{ x: card.distribuirParaObjetivos ? 36 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </motion.div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            onClick={abrirFundoModal}
            className={`relative overflow-hidden rounded-2xl text-white shadow-lg min-h-[210px] cursor-pointer ${fundoAtivo ? 'ring-2 ring-amber-400/30' : 'opacity-80 hover:opacity-100'}`}
            variants={cardVariants}
            custom={cartoes.length}
            whileHover={{
              y: -8,
              scale: 1.02,
              transition: { ...springBouncy, stiffness: 400 },
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${fundoAtivo ? 'from-amber-500 to-amber-700' : 'from-zinc-600 to-zinc-800'}`} />
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 p-5 flex flex-col justify-between min-h-[210px]">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-3">
                  <p className="text-white/70 text-[11px] font-medium mb-0.5">Protecção Financeira</p>
                  <h3 className="text-base font-bold mb-2">Fundo de Emergência</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${fundoAtivo ? 'bg-green-400/20 text-green-200' : 'bg-white/10 text-white/50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${fundoAtivo ? 'bg-green-400' : 'bg-white/30'}`} />
                    {fundoAtivo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <ShieldCheck size={22} className={fundoAtivo ? 'text-amber-200' : 'text-white/25'} />
              </div>
              <div className="mt-5 space-y-1.5">
                {fundo?.existe && fundo.fundo ? (
                  <>
                    <p className="text-white/60 text-[11px]">Saldo Guardado</p>
                    <p className="text-2xl font-bold">{maskValue(formatMoney(fundoSaldo))}</p>
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] text-white/60 mb-1">
                        {fundoAtivo && fundoMetricas
                          ? <><span>{fundoMetricas.mesesCobertos} meses cobertos</span><span>{fundoMetricas.percentualAtingido}%</span></>
                          : <><span>Progresso para activar</span><span>{pctParaAtivo}%</span></>
                        }
                      </div>
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${fundoAtivo && fundoMetricas ? (fundoMetricas.percentualAtingido >= 100 ? 'bg-green-400' : fundoMetricas.percentualAtingido >= 50 ? 'bg-amber-300' : 'bg-red-400') : 'bg-amber-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${fundoAtivo && fundoMetricas ? Math.min(100, fundoMetricas.percentualAtingido) : pctParaAtivo}%` }}
                          transition={{ ...springSmooth, delay: 0.5 }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-white/50 text-[11px]">Activa depositando pelo menos:</p>
                    <p className="text-xl font-bold text-amber-300">100.000 Kz</p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-[10px] text-white/40 text-center">{fundoAtivo ? 'Clica para depositar ou gerir' : 'Clica para activar'}</p>
              </div>
            </div>
          </motion.div>

          <motion.button
            onClick={() => setShowModal(true)}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed min-h-[210px] group"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
            variants={cardVariants}
            custom={cartoes.length + 1}
            whileHover={{
              borderColor: 'var(--accent)',
              scale: 1.02,
              transition: springBouncy,
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-10)' }}
                whileHover={{ scale: 1.1, rotate: 90 }}
                transition={springBouncy}
              >
                <Plus size={22} style={{ color: 'var(--accent)' }} />
              </motion.div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Nova Conta</span>
            </div>
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence>
        {showFundoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setShowFundoModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className={`px-5 py-4 flex items-center gap-3 border-b ${fundoAtivo ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-zinc-600 to-zinc-700'}`}
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="w-9 h-9 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-sm">Fundo de Emergência</h3>
                  <p className="text-white/60 text-[11px]">{fundoAtivo ? 'Reforça o teu escudo' : 'Activa a tua protecção'}</p>
                </div>
                <motion.button
                  onClick={() => setShowFundoModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 text-white"
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.3)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} />
                </motion.button>
              </div>

              <div className="p-5 space-y-4">
                <AnimatePresence>
                  {fundoError && (
                    <motion.div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px]"
                      style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <AlertCircle size={15} className="flex-shrink-0" /> {fundoError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {!fundoAtivo && (
                    <motion.div
                      className="p-4 rounded-xl text-center space-y-2 border"
                      style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <motion.p
                        className="text-2xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >🛡️</motion.p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Deposita pelo menos <span className="font-bold text-amber-400">100.000 Kz</span> para activar
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {fundoAtivo && fundo?.fundo && (
                    <motion.div
                      className="p-4 rounded-xl flex justify-between items-center border"
                      style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div>
                        <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">✅ Fundo Activo</p>
                        <p className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(fundoSaldo))}</p>
                      </div>
                      {fundoMetricas && (
                        <div className="text-right">
                          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Meses cobertos</p>
                          <p className="text-amber-400 font-bold text-xl">{fundoMetricas.mesesCobertos}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field label="Transferir de">
                  <Sel value={cartaoOrigemId} onChange={e => setCartaoOrigemId(e.target.value)}>
                    <option value="">Selecciona um cartão…</option>
                    {cartoesElegiveis.map(c => <option key={c.id} value={c.id}>{c.nome} — {formatMoney(Number(c.saldoDisponivel))} disponível</option>)}
                  </Sel>
                </Field>

                <Field label="Valor a Depositar (Kz)">
                  <Input type="number" min="1" step="1000" placeholder="Mínimo 100.000 Kz"
                    value={depositoValor} onChange={e => setDepositoValor(e.target.value)} />
                  <div className="flex gap-2 mt-2">
                    {[100_000, 250_000, 500_000].map(v => (
                      <motion.button
                        key={v}
                        type="button"
                        onClick={() => setDepositoValor(String(v))}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-medium border"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-faint)' }}
                        whileHover={{ scale: 1.05, borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {v / 1000}K
                      </motion.button>
                    ))}
                  </div>
                </Field>

                <div className="flex gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  <motion.button
                    type="button"
                    onClick={() => setShowFundoModal(false)}
                    className="flex-1 h-11 rounded-xl font-medium text-sm border"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                    whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleDepositar}
                    disabled={fundoLoading || !cartaoOrigemId || !depositoValor}
                    className="flex-1 h-11 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={{ backgroundColor: '#f59e0b', color: '#000' }}
                    whileHover={!fundoLoading && cartaoOrigemId && depositoValor ? { scale: 1.02 } : {}}
                    whileTap={!fundoLoading && cartaoOrigemId && depositoValor ? { scale: 0.98 } : {}}
                  >
                    {fundoLoading ? 'A processar…' : fundoAtivo ? 'Depositar' : 'Depositar e Activar'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => { setShowModal(false); resetForm(); }}
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
                    <CreditCard size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Adicionar Conta</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Preenche os dados da conta</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ color: 'var(--text-faint)' }}
                  whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-elevated)' }}
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
                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="px-3 py-2.5 rounded-xl border text-[11px] font-medium"
                      style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Field label="Nome *">
                    <Input type="text" required placeholder="Ex: Conta Salário BAI"
                      value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
                  </Field>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Field label="Tipo *">
                    <Sel value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as any, saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: '' })}>
                      <option value="DEBITO">Débito (Multicaixa)</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="POUPANCA">Poupança</option>
                    </Sel>
                  </Field>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Field label="Banco / Instituição">
                    <Input type="text" placeholder="Ex: BAI, BFA, BIC…"
                      value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} />
                  </Field>
                </motion.div>

                <AnimatePresence mode="wait">
                  {formData.tipo === 'CREDITO' ? (
                    <motion.div
                      key="credit"
                      className="space-y-3"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Field label="Limite de Crédito (Kz) *">
                        <Input type="number" required min="0.01" step="0.01" placeholder="0.00"
                          value={formData.limiteCredito} onChange={e => setFormData({ ...formData, limiteCredito: e.target.value })} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Dia Fechamento *">
                          <Input type="number" required min="1" max="31" placeholder="15"
                            value={formData.diaFechamento} onChange={e => setFormData({ ...formData, diaFechamento: e.target.value })} />
                        </Field>
                        <Field label="Dia Vencimento *">
                          <Input type="number" required min="1" max="31" placeholder="25"
                            value={formData.diaVencimento} onChange={e => setFormData({ ...formData, diaVencimento: e.target.value })} />
                        </Field>
                      </div>
                      <div className="px-3 py-2.5 rounded-xl border text-[11px]"
                        style={{ backgroundColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                        A fatura inicial será 0 e o saldo disponível igual ao limite informado.
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="debit"
                      className="space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Field label="Saldo Inicial (Kz) *">
                        <Input type="number" required min="0" step="0.01" placeholder="0.00"
                          value={formData.saldoAtual} onChange={e => setFormData({ ...formData, saldoAtual: e.target.value })} />
                      </Field>
                      <div className="px-3 py-2.5 rounded-xl border text-[11px]"
                        style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)', color: '#34d399' }}>
                        O saldo disponível será igual ao saldo inicial informado.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  className="flex items-start gap-3 p-4 rounded-xl border ring-1 ring-inset"
                  style={{ backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)', ringColor: 'rgba(139,92,246,0.1)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.input
                    type="checkbox"
                    id="distribuir"
                    checked={formData.distribuirParaObjetivos}
                    onChange={e => setFormData({ ...formData, distribuirParaObjetivos: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded"
                    whileTap={{ scale: 1.2 }}
                  />
                  <div>
                    <label htmlFor="distribuir" className="text-xs font-bold cursor-pointer" style={{ color: '#a78bfa' }}>Distribuir receitas automaticamente</label>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>Receitas neste cartão serão distribuídas pelos objetivos conforme as suas percentagens.</p>
                  </div>
                </motion.div>

                <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <motion.button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 h-11 rounded-xl font-medium text-sm border"
                    style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                    whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="flex-1 h-11 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Criar Conta
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

export default Wallet;
