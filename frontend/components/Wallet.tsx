// src/components/Wallet.tsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeftRight, Banknote, CreditCard, Plus, Save, ShieldCheck, X } from 'lucide-react';
import api from '../services/api';
import { Cartao } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface FundoStatus {
  existe: boolean; ativo: boolean;
  fundo?: { id: string; nome: string; saldoAtual: number; saldoDisponivel: number };
  metricas?: { despesaMediaMensal: number; alvoEmergencia: number; mesesCobertos: number; percentualAtingido: number; mesesRecomendados: number };
  depositoMinimoAtivacao: number;
}

const MINIMO_ATIVACAO = 100_000;

// ─── Shared inline components ─────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }> = ({ children, className = '', style, onClick }) => (
  <div className={`rounded-2xl border shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', ...style }}
    onClick={onClick}>
    {children}
  </div>
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

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [f, setF] = useState(false);
  return <input {...props}
    onFocus={e => { setF(true); props.onFocus?.(e); }} onBlur={e => { setF(false); props.onBlur?.(e); }}
    style={{ ...inputSt, ...(props.style || {}), border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-base)', boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none' }} />;
};

const Sel: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  const [f, setF] = useState(false);
  return <select {...props}
    onFocus={e => { setF(true); props.onFocus?.(e); }} onBlur={e => { setF(false); props.onBlur?.(e); }}
    style={{ ...inputSt, ...(props.style || {}), appearance: 'none' as any, cursor: 'pointer', border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: f ? 'var(--bg-elevated)' : 'var(--bg-base)', boxShadow: f ? '0 0 0 3px var(--accent-10)' : 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }} />;
};

// ─── Card gradients ────────────────────────────────────────────────────────────
const getGradient = (tipo: string) => ({
  DEBITO:  'from-orange-500 to-orange-700',
  CREDITO: 'from-blue-600 to-indigo-800',
  POUPANCA:'from-emerald-500 to-green-700',
}[tipo] ?? 'from-zinc-600 to-zinc-800');

// ─── Component ────────────────────────────────────────────────────────────────
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
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>A carregar carteira…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Finanças</p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Carteira</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Gere os teus cartões e contas bancárias</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.99]"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
          <Plus size={18} />
          Adicionar Conta
        </button>
      </div>

      {/* Cards grid */}
      {cartoes.length === 0 ? (
        <Card style={{ padding: '64px 24px', textAlign: 'center' }}>
          <CreditCard size={40} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Nenhum cartão adicionado</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>Adiciona a tua primeira conta para começar</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent)' }}>
            <Plus size={16} /> Adicionar Conta
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cartoes.map(card => (
            <div key={card.id} className="relative overflow-hidden rounded-2xl text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(card.tipo)}`} />
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
                  <button onClick={() => toggleDistribuicao(card)} className="flex items-center justify-between w-full hover:bg-white/10 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="text-[11px] text-white/70 font-medium">Distribuição {card.distribuirParaObjetivos ? 'Ativa' : 'Inativa'}</span>
                    <div className="w-9 h-5 rounded-full transition-colors" style={{ backgroundColor: card.distribuirParaObjetivos ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)' }}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${card.distribuirParaObjetivos ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Fundo de Emergência */}
          <div onClick={abrirFundoModal}
            className={`relative overflow-hidden rounded-2xl text-white shadow-lg min-h-[210px] transition-all hover:-translate-y-1 cursor-pointer ${fundoAtivo ? 'ring-2 ring-amber-400/30' : 'opacity-80 hover:opacity-100'}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${fundoAtivo ? 'from-amber-500 to-amber-700' : 'from-zinc-600 to-zinc-800'}`} />
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 p-5 flex flex-col justify-between min-h-[210px]">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-3">
                  <p className="text-white/70 text-[11px] font-medium mb-0.5">Protecção Financeira</p>
                  <h3 className="text-base font-bold mb-2">Fundo de Emergência</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${fundoAtivo ? 'bg-green-400/20 text-green-200' : 'bg-white/10 text-white/50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${fundoAtivo ? 'bg-green-400 animate-ping' : 'bg-white/30'}`} />
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
                        <div className={`h-full rounded-full transition-all ${fundoAtivo && fundoMetricas ? (fundoMetricas.percentualAtingido >= 100 ? 'bg-green-400' : fundoMetricas.percentualAtingido >= 50 ? 'bg-amber-300' : 'bg-red-400') : 'bg-amber-400'}`}
                          style={{ width: `${fundoAtivo && fundoMetricas ? Math.min(100, fundoMetricas.percentualAtingido) : pctParaAtivo}%` }} />
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
          </div>

          {/* Add button */}
          <button onClick={() => setShowModal(true)}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed min-h-[210px] group transition-all"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
            onMouseEnter={e => { (e.currentTarget).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor = 'var(--border-strong)'; }}>
            <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-10)' }}>
                <Plus size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Nova Conta</span>
            </div>
          </button>
        </div>
      )}

      {/* MODAL FUNDO */}
      {showFundoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>

            <div className={`px-5 py-4 flex items-center gap-3 border-b ${fundoAtivo ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-zinc-600 to-zinc-700'}`}
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-9 h-9 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Fundo de Emergência</h3>
                <p className="text-white/60 text-[11px]">{fundoAtivo ? 'Reforça o teu escudo' : 'Activa a tua protecção'}</p>
              </div>
              <button onClick={() => setShowFundoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {fundoError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px]"
                  style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <AlertCircle size={15} className="flex-shrink-0" /> {fundoError}
                </div>
              )}

              {!fundoAtivo && (
                <div className="p-4 rounded-xl text-center space-y-2 border"
                  style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  <p className="text-2xl">🛡️</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Deposita pelo menos <span className="font-bold text-amber-400">100.000 Kz</span> para activar
                  </p>
                </div>
              )}

              {fundoAtivo && fundo?.fundo && (
                <div className="p-4 rounded-xl flex justify-between items-center border"
                  style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
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
                </div>
              )}

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
                    <button key={v} type="button" onClick={() => setDepositoValor(String(v))}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-faint)' }}
                      onMouseEnter={e => { (e.currentTarget).style.color = '#fcd34d'; (e.currentTarget).style.borderColor = 'rgba(245,158,11,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; (e.currentTarget).style.borderColor = 'var(--border)'; }}>
                      {v / 1000}K
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setShowFundoModal(false)}
                  className="flex-1 h-11 rounded-xl font-medium text-sm transition-all border"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleDepositar} disabled={fundoLoading || !cartaoOrigemId || !depositoValor}
                  className="flex-1 h-11 rounded-xl font-bold text-sm transition-all disabled:opacity-40 hover:scale-[1.02]"
                  style={{ backgroundColor: '#f59e0b', color: '#000' }}>
                  {fundoLoading ? 'A processar…' : fundoAtivo ? 'Depositar' : 'Depositar e Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARTÃO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>

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
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-xl border text-[11px] font-medium"
                  style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <Field label="Nome *">
                <Input type="text" required placeholder="Ex: Conta Salário BAI"
                  value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
              </Field>

              <Field label="Tipo *">
                <Sel value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as any, saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: '' })}>
                  <option value="DEBITO">Débito (Multicaixa)</option>
                  <option value="CREDITO">Crédito</option>
                  <option value="POUPANCA">Poupança</option>
                </Sel>
              </Field>

              <Field label="Banco / Instituição">
                <Input type="text" placeholder="Ex: BAI, BFA, BIC…"
                  value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} />
              </Field>

              {formData.tipo === 'CREDITO' ? (
                <>
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
                </>
              ) : (
                <>
                  <Field label="Saldo Inicial (Kz) *">
                    <Input type="number" required min="0" step="0.01" placeholder="0.00"
                      value={formData.saldoAtual} onChange={e => setFormData({ ...formData, saldoAtual: e.target.value })} />
                  </Field>
                  <div className="px-3 py-2.5 rounded-xl border text-[11px]"
                    style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)', color: '#34d399' }}>
                    O saldo disponível será igual ao saldo inicial informado.
                  </div>
                </>
              )}

              {/* Distribuição toggle */}
              <div className="flex items-start gap-3 p-4 rounded-xl border ring-1 ring-inset"
                style={{ backgroundColor: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)', ringColor: 'rgba(139,92,246,0.1)' }}>
                <input type="checkbox" id="distribuir" checked={formData.distribuirParaObjetivos}
                  onChange={e => setFormData({ ...formData, distribuirParaObjetivos: e.target.checked })} className="w-4 h-4 mt-0.5 rounded" />
                <div>
                  <label htmlFor="distribuir" className="text-xs font-bold cursor-pointer" style={{ color: '#a78bfa' }}>Distribuir receitas automaticamente</label>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>Receitas neste cartão serão distribuídas pelos objetivos conforme as suas percentagens.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 h-11 rounded-xl font-medium text-sm transition-all border"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 h-11 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                  Criar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;