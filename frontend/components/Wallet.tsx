// src/components/Wallet.tsx
import React, { useEffect, useState } from 'react';
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

  const fetchCards = async () => {
    try { const { data } = await api.get('/cartoes'); setCartoes(data.cartoes || []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const fetchFundo = async () => {
    try { const { data } = await api.get('/fundo-emergencia'); setFundo(data); }
    catch (e) { console.error(e); }
  };

  const abrirFundoModal = () => { setFundoError(''); setDepositoValor(''); setCartaoOrigemId(''); setShowFundoModal(true); };

  const handleDepositar = async () => {
    const valor = parseFloat(depositoValor);
    if (!valor || valor <= 0) { setFundoError('Insere um valor válido.'); return; }
    if (!cartaoOrigemId)      { setFundoError('Selecciona o cartão de origem.'); return; }
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

  const getGradient = (tipo: string) => ({ DEBITO: 'from-orange-500 to-orange-700', CREDITO: 'from-blue-600 to-indigo-800', POUPANCA: 'from-emerald-500 to-green-700' }[tipo] ?? 'from-gray-700 to-gray-900');
  const getIcon    = (tipo: string) => ({ DEBITO: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', POUPANCA: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }[tipo] ?? 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z');

  const cartoesElegiveis = cartoes.filter(c => c.tipo !== 'CREDITO' && !(c as any).isFundoEmergencia);
  const fundoAtivo = fundo?.ativo ?? false;
  const fundoSaldo = fundo?.fundo?.saldoAtual ?? 0;
  const fundoMetricas = fundo?.metricas;
  const pctParaAtivo = Math.min(100, Math.round((fundoSaldo / MINIMO_ATIVACAO) * 100));

  // reusable input style
  const inp: React.CSSProperties = { width: '100%', height: 48, backgroundColor: 'var(--bg-base)', border: 'none', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'box-shadow 200ms' };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' };
  const focusAccent = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 1px var(--accent)'; };
  const blurAccent  = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>A carregar carteira…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Gere os teus cartões e contas bancárias</p>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Adicionar Conta
        </button>
      </div>

      {cartoes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <div>
              <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Nenhum cartão adicionado</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-faint)' }}>Adiciona a tua primeira conta para começar</p>
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 font-medium text-sm transition-colors" style={{ color: 'var(--accent)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Adicionar Conta
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cartoes.map(card => (
            <div key={card.id} className="relative overflow-hidden rounded-2xl text-white shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl group">
              <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(card.tipo)}`} />
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10 p-6 flex flex-col justify-between min-h-[220px]">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm font-medium mb-1">{card.banco || 'KwanzaPro'}</p>
                    <h3 className="text-xl font-bold mb-2">{card.nome}</h3>
                    <span className="inline-block px-2.5 py-1 bg-white/20 rounded-full text-xs uppercase font-bold tracking-wider">
                      {card.tipo === 'DEBITO' ? 'Débito' : card.tipo === 'CREDITO' ? 'Crédito' : 'Poupança'}
                    </span>
                  </div>
                  <svg className="w-6 h-6 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getIcon(card.tipo)} /></svg>
                </div>
                <div className="mt-6 space-y-2">
                  {card.tipo === 'CREDITO' ? (
                    <>
                      <p className="text-white/70 text-sm">Fatura Atual</p>
                      <p className="text-3xl font-black">{maskValue(formatMoney(Number(card.saldoAtual)))}</p>
                      <div className="flex justify-between text-xs text-white/80 pt-3 border-t border-white/20">
                        <span>Limite: {maskValue(formatMoney(Number(card.limiteCredito || 0)))}</span>
                        <span className="text-green-200 font-semibold">Disp: {maskValue(formatMoney(Number(card.saldoDisponivel || 0)))}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/70 text-sm">Saldo Atual</p>
                      <p className="text-3xl font-black">{maskValue(formatMoney(Number(card.saldoAtual)))}</p>
                      <div className="flex justify-between text-xs text-white/80 pt-3 border-t border-white/20">
                        <span>Disponível: {maskValue(formatMoney(Number(card.saldoDisponivel || 0)))}</span>
                        {Number(card.saldoReservado || 0) > 0 && <span className="text-yellow-200">Reservado: {maskValue(formatMoney(Number(card.saldoReservado)))}</span>}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <button onClick={() => toggleDistribuicao(card)} className="flex items-center justify-between w-full hover:bg-white/10 p-2 rounded-lg transition-colors">
                    <span className="text-xs text-white/80 font-medium">Distribuição {card.distribuirParaObjetivos ? 'Ativa' : 'Inativa'}</span>
                    <div className="w-10 h-6 rounded-full transition-colors" style={{ backgroundColor: card.distribuirParaObjetivos ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-lg transform transition-transform mt-1 ${card.distribuirParaObjetivos ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Fundo de Emergência */}
          <div onClick={abrirFundoModal}
            className={`relative overflow-hidden rounded-2xl text-white shadow-xl min-h-[220px] transition-all hover:-translate-y-1 cursor-pointer ${fundoAtivo ? 'ring-2 ring-amber-400/40' : 'opacity-80 hover:opacity-100'}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${fundoAtivo ? 'from-amber-500 to-amber-700' : 'from-slate-600 to-slate-800'}`} />
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 p-6 flex flex-col justify-between min-h-[220px]">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <p className="text-white/80 text-sm font-medium mb-1">Protecção Financeira</p>
                  <h3 className="text-xl font-bold mb-2">Fundo de Emergência</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${fundoAtivo ? 'bg-green-400/20 text-green-200' : 'bg-white/10 text-white/50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${fundoAtivo ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                    {fundoAtivo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <svg className={`w-7 h-7 flex-shrink-0 ${fundoAtivo ? 'text-amber-200' : 'text-white/25'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div className="mt-6 space-y-2">
                {fundo?.existe && fundo.fundo ? (
                  <>
                    <p className="text-white/70 text-sm">Saldo Guardado</p>
                    <p className="text-3xl font-black">{maskValue(formatMoney(fundoSaldo))}</p>
                    <div className="pt-1">
                      <div className="flex justify-between text-xs text-white/70 mb-1.5">
                        {fundoAtivo && fundoMetricas ? (<><span>{fundoMetricas.mesesCobertos} meses cobertos</span><span>{fundoMetricas.percentualAtingido}%</span></>) : (<><span>Progresso para activar</span><span>{pctParaAtivo}%</span></>)}
                      </div>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${fundoAtivo && fundoMetricas ? (fundoMetricas.percentualAtingido >= 100 ? 'bg-green-400' : fundoMetricas.percentualAtingido >= 50 ? 'bg-amber-300' : 'bg-red-400') : 'bg-amber-400'}`}
                          style={{ width: `${fundoAtivo && fundoMetricas ? Math.min(100, fundoMetricas.percentualAtingido) : pctParaAtivo}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-white/50 text-sm">O teu escudo para imprevistos. Activa depositando pelo menos:</p>
                    <p className="text-2xl font-black text-amber-300">100.000 Kz</p>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs text-white/40 text-center">{fundoAtivo ? 'Clica para depositar ou gerir' : 'Clica para activar'}</p>
              </div>
            </div>
          </div>

          {/* Botão adicionar */}
          <button onClick={() => setShowModal(true)}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed min-h-[220px] group transition-all"
            style={{ borderColor: 'var(--border-strong)', backgroundColor: 'rgba(255,255,255,0.02)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'; }}>
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="font-bold" style={{ color: 'var(--text-faint)' }}>Adicionar Nova Conta</span>
            </div>
          </button>
        </div>
      )}

      {/* MODAL FUNDO */}
      {showFundoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <div className={`p-6 flex items-center gap-4 ${fundoAtivo ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
              <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-lg">Fundo de Emergência</h3>
                <p className="text-white/70 text-sm">{fundoAtivo ? 'Reforça o teu escudo' : 'Activa a tua protecção'}</p>
              </div>
              <button onClick={() => setShowFundoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {fundoError && <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg">{fundoError}</div>}
              {!fundoAtivo && (
                <div className="p-5 rounded-xl text-center space-y-3" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div className="text-4xl">🛡️</div>
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    Deposita pelo menos <span className="text-amber-400 text-lg">100.000 Kz</span> para activar
                  </p>
                </div>
              )}
              {fundoAtivo && fundo?.fundo && (
                <div className="p-4 rounded-xl flex justify-between items-center" style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div>
                    <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">✅ Fundo Activo</p>
                    <p className="font-black text-2xl" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(fundoSaldo))}</p>
                  </div>
                  {fundoMetricas && <div className="text-right"><p className="text-xs" style={{ color: 'var(--text-faint)' }}>Meses cobertos</p><p className="text-amber-300 font-black text-2xl">{fundoMetricas.mesesCobertos}</p></div>}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Transferir de</label>
                <select value={cartaoOrigemId} onChange={e => setCartaoOrigemId(e.target.value)} style={sel} onFocus={e => { e.target.style.boxShadow = '0 0 0 1px #f59e0b'; }} onBlur={e => { e.target.style.boxShadow = 'none'; }}>
                  <option value="">Selecciona um cartão…</option>
                  {cartoesElegiveis.map(c => <option key={c.id} value={c.id}>{c.nome} — {formatMoney(Number(c.saldoDisponivel))} disponível</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Valor a Depositar (Kz)</label>
                <input type="number" min="1" step="1000" placeholder="Mínimo para activar: 100.000" value={depositoValor} onChange={e => setDepositoValor(e.target.value)} style={inp} onFocus={e => { e.target.style.boxShadow = '0 0 0 1px #f59e0b'; }} onBlur={e => { e.target.style.boxShadow = 'none'; }} />
                <div className="flex gap-2 mt-2">
                  {[100_000, 250_000, 500_000].map(v => (
                    <button key={v} type="button" onClick={() => setDepositoValor(String(v))}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-faint)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fcd34d'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
                      {v / 1000}K
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowFundoModal(false)} className="flex-1 h-12 rounded-xl font-medium transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>Cancelar</button>
                <button type="button" onClick={handleDepositar} disabled={fundoLoading || !cartaoOrigemId || !depositoValor}
                  className="flex-1 h-12 rounded-xl font-black transition-all disabled:opacity-40"
                  style={{ backgroundColor: '#f59e0b', color: '#000', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}>
                  {fundoLoading ? 'A processar…' : fundoAtivo ? 'Depositar' : 'Depositar e Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARTÃO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Adicionar Conta/Cartão</h3>
              {error && <div className="mb-4 p-3 rounded-lg text-sm text-red-400 bg-red-900/20 border border-red-500/30">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nome *</label><input type="text" required placeholder="Ex: Conta Salário BAI" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tipo *</label>
                  <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as any, saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: '' })} style={sel} onFocus={focusAccent} onBlur={blurAccent}>
                    <option value="DEBITO">Débito (Multicaixa)</option><option value="CREDITO">Crédito</option><option value="POUPANCA">Poupança</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Banco / Instituição</label><input type="text" placeholder="Ex: BAI, BFA, BIC…" value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                {formData.tipo === 'CREDITO' ? (
                  <>
                    <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Limite de Crédito (Kz) *</label><input type="number" required min="0.01" step="0.01" placeholder="0.00" value={formData.limiteCredito} onChange={e => setFormData({ ...formData, limiteCredito: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Dia Fechamento *</label><input type="number" required min="1" max="31" placeholder="15" value={formData.diaFechamento} onChange={e => setFormData({ ...formData, diaFechamento: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                      <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Dia Vencimento *</label><input type="number" required min="1" max="31" placeholder="25" value={formData.diaVencimento} onChange={e => setFormData({ ...formData, diaVencimento: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}><p className="text-xs text-blue-400">A fatura inicial será 0 e o saldo disponível igual ao limite informado.</p></div>
                  </>
                ) : (
                  <>
                    <div><label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Saldo Inicial (Kz) *</label><input type="number" required min="0" step="0.01" placeholder="0.00" value={formData.saldoAtual} onChange={e => setFormData({ ...formData, saldoAtual: e.target.value })} style={inp} onFocus={focusAccent} onBlur={blurAccent} /></div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}><p className="text-xs text-emerald-400">O saldo disponível será igual ao saldo inicial informado.</p></div>
                  </>
                )}
                <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
                  <input type="checkbox" id="distribuir" checked={formData.distribuirParaObjetivos} onChange={e => setFormData({ ...formData, distribuirParaObjetivos: e.target.checked })} className="w-4 h-4 mt-0.5 rounded" />
                  <div><label htmlFor="distribuir" className="text-sm font-medium text-purple-300 cursor-pointer">Distribuir receitas automaticamente</label><p className="text-xs text-purple-400/80 mt-1">Receitas neste cartão serão distribuídas pelos objetivos conforme as suas percentagens.</p></div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 h-12 rounded-xl font-medium transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>Cancelar</button>
                  <button type="submit" className="flex-1 h-12 rounded-xl font-bold transition-all" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>Criar Conta</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;