import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Cartao } from '../types';

// ── Tipo do fundo de emergência (resposta da API) ──────────────────────────
interface FundoStatus {
  existe: boolean;
  ativo: boolean;
  fundo?: {
    id: string;
    nome: string;
    saldoAtual: number;
    saldoDisponivel: number;
  };
  metricas?: {
    despesaMediaMensal: number;
    alvoEmergencia: number;
    mesesCobertos: number;
    percentualAtingido: number;
    mesesRecomendados: number;
  };
  depositoMinimoAtivacao: number;
}

const MINIMO_ATIVACAO = 100_000;

// ══════════════════════════════════════════════════════════════════════════════
// WALLET
// ══════════════════════════════════════════════════════════════════════════════
const Wallet: React.FC = () => {
  // cartões normais
  const [cartoes, setCartoes]     = useState<Cartao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError]         = useState('');

  // fundo de emergência
  const [fundo, setFundo]                   = useState<FundoStatus | null>(null);
  const [showFundoModal, setShowFundoModal] = useState(false);
  const [fundoLoading, setFundoLoading]     = useState(false);
  const [fundoError, setFundoError]         = useState('');
  const [depositoValor, setDepositoValor]   = useState('');
  const [cartaoOrigemId, setCartaoOrigemId] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'DEBITO' as 'DEBITO' | 'CREDITO' | 'POUPANCA',
    banco: '',
    saldoAtual: '',
    limiteCredito: '',
    diaFechamento: '',
    diaVencimento: '',
    distribuirParaObjetivos: false,
  });

  useEffect(() => {
    fetchCards();
    fetchFundo();
  }, []);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchCards = async () => {
    try {
      const { data } = await api.get('/cartoes');
      setCartoes(data.cartoes || []);
    } catch (err) {
      console.error('Erro ao carregar cartões', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFundo = async () => {
    try {
      const { data } = await api.get('/fundo-emergencia');
      setFundo(data);
    } catch (err) {
      console.error('Erro ao carregar fundo de emergência', err);
    }
  };

  // ── fundo: ações ──────────────────────────────────────────────────────────
  const abrirFundoModal = () => {
    setFundoError('');
    setDepositoValor('');
    setCartaoOrigemId('');
    setShowFundoModal(true);
  };

  const handleDepositar = async () => {
    const valor = parseFloat(depositoValor);
    if (!valor || valor <= 0) { setFundoError('Insere um valor válido.'); return; }
    if (!cartaoOrigemId)      { setFundoError('Selecciona o cartão de origem.'); return; }

    setFundoLoading(true);
    setFundoError('');
    try {
      // cria o fundo se ainda não existir
      if (!fundo?.existe) {
        await api.post('/fundo-emergencia').catch(e => {
          if (e.response?.status !== 409) throw e; // ignora "já existe"
        });
      }
      await api.post('/fundo-emergencia/depositar', { cartaoOrigemId, valor });
      await Promise.all([fetchFundo(), fetchCards()]);
      setShowFundoModal(false);
    } catch (err: any) {
      setFundoError(err.response?.data?.message || 'Erro ao processar depósito.');
    } finally {
      setFundoLoading(false);
    }
  };

  // ── cartões: ações ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload: any = {
        nome: formData.nome,
        tipo: formData.tipo,
        banco: formData.banco || undefined,
        distribuirParaObjetivos: formData.distribuirParaObjetivos,
      };
      if (formData.tipo === 'CREDITO') {
        payload.limiteCredito = parseFloat(formData.limiteCredito);
        payload.diaFechamento = parseInt(formData.diaFechamento);
        payload.diaVencimento = parseInt(formData.diaVencimento);
      } else {
        payload.saldoAtual = parseFloat(formData.saldoAtual);
      }
      await api.post('/cartoes', payload);
      setShowModal(false);
      fetchCards();
      resetForm();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.mensagem ||
        'Erro ao adicionar cartão'
      );
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', tipo: 'DEBITO', banco: '', saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: '', distribuirParaObjetivos: false });
    setError('');
  };

  const toggleDistribuicao = async (card: Cartao) => {
    try {
      await api.patch(`/cartoes/${card.id}`, { distribuirParaObjetivos: !card.distribuirParaObjetivos });
      fetchCards();
    } catch (err) {
      console.error('Erro ao atualizar cartão', err);
    }
  };

  // ── helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (v: number) =>
    Number(v).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' });

  const getCardGradient = (tipo: string) => {
    const map: Record<string, string> = {
      DEBITO: 'from-orange-500 to-orange-700',
      CREDITO: 'from-blue-600 to-indigo-800',
      POUPANCA: 'from-emerald-500 to-green-700',
    };
    return map[tipo] ?? 'from-gray-700 to-gray-900';
  };

  const getCardIcon = (tipo: string) => {
    const map: Record<string, string> = {
      DEBITO: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      CREDITO: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      POUPANCA: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    };
    return map[tipo] ?? map['DEBITO'];
  };

  // cartões elegíveis para depósito no fundo
  const cartoesElegiveis = cartoes.filter(
    c => c.tipo !== 'CREDITO' && !(c as any).isFundoEmergencia
  );

  const fundoAtivo    = fundo?.ativo ?? false;
  const fundoSaldo    = fundo?.fundo?.saldoAtual ?? 0;
  const fundoMetricas = fundo?.metricas;
  const pctParaAtivo  = Math.min(100, Math.round((fundoSaldo / MINIMO_ATIVACAO) * 100));

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#cbfb46] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm font-medium">A carregar carteira...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="text-sm text-white/40">Gere os teus cartões e contas bancárias</p>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#cbfb46] hover:bg-[#b8e63e] text-black px-6 py-3 rounded-full flex items-center gap-2 font-bold transition-all shadow-[0_0_20px_rgba(203,251,70,0.2)] hover:scale-[1.02]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Conta
        </button>
      </div>

      {/* ── Grid ── */}
      {cartoes.length === 0 ? (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Nenhum cartão adicionado</h3>
              <p className="text-white/40 text-sm mb-4">Adiciona a tua primeira conta para começar</p>
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 text-[#cbfb46] hover:text-[#b8e63e] font-medium text-sm transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar Conta
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Cartões normais ── */}
          {cartoes.map((card) => (
            <div key={card.id} className="relative overflow-hidden rounded-2xl text-white shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl group">
              <div className={`absolute inset-0 bg-gradient-to-br ${getCardGradient(card.tipo)}`} />
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

              <div className="relative z-10 p-6 flex flex-col justify-between min-h-[220px]">
                {/* top */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm font-medium mb-1">{card.banco || 'KwanzaPro'}</p>
                    <h3 className="text-xl font-bold mb-2">{card.nome}</h3>
                    <span className="inline-block px-2.5 py-1 bg-white/20 rounded-full text-xs uppercase font-bold tracking-wider">
                      {card.tipo === 'DEBITO' ? 'Débito' : card.tipo === 'CREDITO' ? 'Crédito' : 'Poupança'}
                    </span>
                  </div>
                  <svg className="w-6 h-6 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCardIcon(card.tipo)} />
                  </svg>
                </div>

                {/* balance */}
                <div className="mt-6 space-y-2">
                  {card.tipo === 'CREDITO' ? (
                    <>
                      <p className="text-white/70 text-sm">Fatura Atual</p>
                      <p className="text-3xl font-black tracking-tight">{formatCurrency(Number(card.saldoAtual))}</p>
                      <div className="flex justify-between text-xs text-white/80 pt-3 border-t border-white/20">
                        <span>Limite: {formatCurrency(Number(card.limiteCredito || 0))}</span>
                        <span className="text-green-200 font-semibold">Disp: {formatCurrency(Number(card.saldoDisponivel || 0))}</span>
                      </div>
                      {card.diaFechamento && card.diaVencimento && (
                        <p className="text-xs text-white/60 mt-2">Fatura: dia {card.diaFechamento} • Venc: dia {card.diaVencimento}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-white/70 text-sm">Saldo Atual</p>
                      <p className="text-3xl font-black tracking-tight">{formatCurrency(Number(card.saldoAtual))}</p>
                      <div className="flex justify-between text-xs text-white/80 pt-3 border-t border-white/20">
                        <span>Disponível: {formatCurrency(Number(card.saldoDisponivel || 0))}</span>
                        {Number(card.saldoReservado || 0) > 0 && (
                          <span className="text-yellow-200">Reservado: {formatCurrency(Number(card.saldoReservado))}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* toggle distribuição */}
                <div className="mt-4 pt-4 border-t border-white/20">
                  <button onClick={() => toggleDistribuicao(card)} className="flex items-center justify-between w-full hover:bg-white/10 p-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-white/80 font-medium">Distribuição {card.distribuirParaObjetivos ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors ${card.distribuirParaObjetivos ? 'bg-[#cbfb46]' : 'bg-white/20'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-lg transform transition-transform mt-1 ${card.distribuirParaObjetivos ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* CARD — FUNDO DE EMERGÊNCIA                        */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div
            onClick={abrirFundoModal}
            className={[
              'relative overflow-hidden rounded-2xl text-white shadow-xl min-h-[220px]',
              'transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer',
              fundoAtivo
                ? 'ring-2 ring-amber-400/40 shadow-[0_0_28px_rgba(251,191,36,0.14)]'
                : 'opacity-80 hover:opacity-100',
            ].join(' ')}
          >
            {/* fundo gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${fundoAtivo ? 'from-amber-500 to-amber-700' : 'from-slate-600 to-slate-800'}`} />
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

            {/* cadeado quando inactivo */}
            {!fundoAtivo && (
              <div className="absolute top-5 right-5 z-10">
                <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}

            <div className="relative z-10 p-6 flex flex-col justify-between min-h-[220px]">
              {/* top */}
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <p className="text-white/80 text-sm font-medium mb-1">Protecção Financeira</p>
                  <h3 className="text-xl font-bold mb-2">Fundo de Emergência</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${fundoAtivo ? 'bg-green-400/20 text-green-200' : 'bg-white/10 text-white/50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${fundoAtivo ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                    {fundoAtivo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {/* escudo */}
                <svg className={`w-7 h-7 flex-shrink-0 ${fundoAtivo ? 'text-amber-200' : 'text-white/25'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              {/* body */}
              <div className="mt-6 space-y-2">
                {fundo?.existe && fundo.fundo ? (
                  <>
                    <p className="text-white/70 text-sm">Saldo Guardado</p>
                    <p className="text-3xl font-black tracking-tight">{formatCurrency(fundoSaldo)}</p>

                    {fundoAtivo && fundoMetricas ? (
                      /* progresso em relação ao alvo de 6 meses */
                      <div className="pt-1">
                        <div className="flex justify-between text-xs text-white/70 mb-1.5">
                          <span>{fundoMetricas.mesesCobertos} meses cobertos</span>
                          <span>{fundoMetricas.percentualAtingido}% do alvo</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${fundoMetricas.percentualAtingido >= 100 ? 'bg-green-400' : fundoMetricas.percentualAtingido >= 50 ? 'bg-amber-300' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(100, fundoMetricas.percentualAtingido)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-white/50 mt-2 pt-2 border-t border-white/20">
                          <span>Alvo: {formatCurrency(fundoMetricas.alvoEmergencia)}</span>
                          <span className="text-amber-200/80">{fundoMetricas.mesesRecomendados} meses</span>
                        </div>
                      </div>
                    ) : (
                      /* progresso em relação ao mínimo de activação */
                      <div className="pt-1">
                        <div className="flex justify-between text-xs text-white/70 mb-1.5">
                          <span>Progresso para activar</span>
                          <span>{pctParaAtivo}%</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pctParaAtivo}%` }} />
                        </div>
                        <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/20">
                          Faltam {formatCurrency(Math.max(0, MINIMO_ATIVACAO - fundoSaldo))} para activar
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  /* nunca fez depósito */
                  <div className="space-y-1.5">
                    <p className="text-white/50 text-sm leading-relaxed">
                      O teu escudo para imprevistos. Activa depositando pelo menos:
                    </p>
                    <p className="text-2xl font-black text-amber-300">100.000 Kz</p>
                  </div>
                )}
              </div>

              {/* rodapé */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs text-white/40 text-center">
                  {fundoAtivo ? 'Clica para depositar ou gerir' : 'Clica para activar'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Botão adicionar conta ── */}
          <button
            onClick={() => setShowModal(true)}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed border-white/20 hover:border-[#cbfb46] transition-all group min-h-[220px] bg-white/[0.02] hover:bg-white/[0.05]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#cbfb46]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-[#cbfb46]/10 group-hover:bg-[#cbfb46]/20 flex items-center justify-center transition-colors">
                <svg className="w-7 h-7 text-[#cbfb46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="font-bold text-white/60 group-hover:text-[#cbfb46] transition-colors">Adicionar Nova Conta</span>
            </div>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL — FUNDO DE EMERGÊNCIA                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showFundoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#15191E] rounded-2xl w-full max-w-md shadow-2xl border border-white/10 overflow-hidden">

            {/* header */}
            <div className={`p-6 flex items-center gap-4 ${fundoAtivo ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
              <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-lg">Fundo de Emergência</h3>
                <p className="text-white/70 text-sm">
                  {fundoAtivo ? 'Reforça o teu escudo financeiro' : 'Activa a tua protecção financeira'}
                </p>
              </div>
              <button
                onClick={() => setShowFundoModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* erro */}
              {fundoError && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fundoError}
                </div>
              )}

              {/* ── estado: INACTIVO ── */}
              {!fundoAtivo && (
                <div className="p-5 bg-amber-500/[0.08] border border-amber-500/25 rounded-xl text-center space-y-3">
                  <div className="text-4xl">🛡️</div>
                  <p className="text-white font-bold text-base leading-snug">
                    Deposita pelo menos{' '}
                    <span className="text-amber-400 text-lg">100.000 Kz</span>{' '}
                    para activar o fundo
                  </p>
                  {fundo?.existe && fundoSaldo > 0 && (
                    <div className="pt-1">
                      <p className="text-white/50 text-xs mb-2">
                        Saldo actual: <span className="text-white font-bold">{formatCurrency(fundoSaldo)}</span>
                        {' — '}faltam <span className="text-amber-300 font-bold">{formatCurrency(Math.max(0, MINIMO_ATIVACAO - fundoSaldo))}</span>
                      </p>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pctParaAtivo}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── estado: ACTIVO ── */}
              {fundoAtivo && fundo?.fundo && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">✅ Fundo Activo</p>
                    <p className="text-white font-black text-2xl">{formatCurrency(fundoSaldo)}</p>
                  </div>
                  {fundoMetricas && (
                    <div className="text-right">
                      <p className="text-white/50 text-xs">Meses cobertos</p>
                      <p className="text-amber-300 font-black text-2xl">{fundoMetricas.mesesCobertos}</p>
                    </div>
                  )}
                </div>
              )}

              {/* cartão de origem */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Transferir de</label>
                <select
                  value={cartaoOrigemId}
                  onChange={e => setCartaoOrigemId(e.target.value)}
                  className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white focus:ring-1 focus:ring-amber-400 outline-none appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                >
                  <option value="">Selecciona um cartão...</option>
                  {cartoesElegiveis.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {formatCurrency(Number(c.saldoDisponivel))} disponível
                    </option>
                  ))}
                </select>
                {cartoesElegiveis.length === 0 && (
                  <p className="text-amber-400/70 text-xs mt-1.5">
                    Não tens cartões de débito ou poupança com saldo disponível.
                  </p>
                )}
              </div>

              {/* valor */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Valor a Depositar (Kz)</label>
                <input
                  type="number" min="1" step="1000"
                  value={depositoValor}
                  onChange={e => setDepositoValor(e.target.value)}
                  placeholder="Mínimo para activar: 100.000"
                  className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/30 focus:ring-1 focus:ring-amber-400 outline-none"
                />
                {/* atalhos */}
                <div className="flex gap-2 mt-2">
                  {[100_000, 250_000, 500_000].map(v => (
                    <button key={v} type="button" onClick={() => setDepositoValor(String(v))}
                      className="flex-1 py-1.5 bg-white/[0.04] hover:bg-amber-500/10 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 rounded-lg text-xs text-white/50 font-medium transition-all">
                      {v / 1000}K
                    </button>
                  ))}
                </div>
              </div>

              {/* botões */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowFundoModal(false)}
                  className="flex-1 h-12 text-white/60 font-medium hover:bg-white/5 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleDepositar}
                  disabled={fundoLoading || !cartaoOrigemId || !depositoValor}
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                  {fundoLoading ? 'A processar...' : fundoAtivo ? 'Depositar' : 'Depositar e Activar'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL — ADICIONAR CARTÃO                                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#15191E] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Adicionar Conta/Cartão</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* nome */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Nome da Conta *</label>
                  <input type="text" required value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none"
                    placeholder="Ex: Conta Salário BAI" />
                </div>

                {/* tipo */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Tipo *</label>
                  <select value={formData.tipo}
                    onChange={e => setFormData({...formData, tipo: e.target.value as any, saldoAtual: '', limiteCredito: '', diaFechamento: '', diaVencimento: ''})}
                    className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white focus:ring-1 focus:ring-[#cbfb46] outline-none appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                    <option value="DEBITO">Débito (Multicaixa)</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="POUPANCA">Poupança</option>
                  </select>
                </div>

                {/* banco */}
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Banco / Instituição</label>
                  <input type="text" value={formData.banco}
                    onChange={e => setFormData({...formData, banco: e.target.value})}
                    className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none"
                    placeholder="Ex: BAI, BFA, BIC..." />
                </div>

                {/* campos condicionais */}
                {formData.tipo === 'CREDITO' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Limite de Crédito (Kz) *</label>
                      <input type="number" required min="0.01" step="0.01" value={formData.limiteCredito}
                        onChange={e => setFormData({...formData, limiteCredito: e.target.value})}
                        className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none" placeholder="0.00" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Dia Fechamento *</label>
                        <input type="number" required min="1" max="31" value={formData.diaFechamento}
                          onChange={e => setFormData({...formData, diaFechamento: e.target.value})}
                          className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none" placeholder="Ex: 15" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Dia Vencimento *</label>
                        <input type="number" required min="1" max="31" value={formData.diaVencimento}
                          onChange={e => setFormData({...formData, diaVencimento: e.target.value})}
                          className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none" placeholder="Ex: 25" />
                      </div>
                    </div>
                    <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                      <div className="flex gap-2 text-blue-400">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs">A fatura inicial será 0 e o saldo disponível será igual ao limite de crédito informado.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Saldo Inicial (Kz) *</label>
                      <input type="number" required min="0" step="0.01" value={formData.saldoAtual}
                        onChange={e => setFormData({...formData, saldoAtual: e.target.value})}
                        className="w-full bg-[#0B0E11] border-none rounded-lg h-12 px-4 text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#cbfb46] outline-none" placeholder="0.00" />
                    </div>
                    <div className="p-3 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                      <div className="flex gap-2 text-emerald-400">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs">O saldo disponível será igual ao saldo inicial informado.</p>
                      </div>
                    </div>
                  </>
                )}

                {/* distribuição */}
                <div className="flex items-start gap-3 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <input type="checkbox" id="distribuir" checked={formData.distribuirParaObjetivos}
                    onChange={e => setFormData({...formData, distribuirParaObjetivos: e.target.checked})}
                    className="w-4 h-4 text-[#cbfb46] bg-[#0B0E11] border-white/20 rounded focus:ring-[#cbfb46] focus:ring-offset-0 mt-0.5" />
                  <div className="flex-1">
                    <label htmlFor="distribuir" className="text-sm font-medium text-purple-300 cursor-pointer">Distribuir receitas automaticamente</label>
                    <p className="text-xs text-purple-400/80 mt-1">Quando ativo, todas as receitas neste cartão serão distribuídas automaticamente pelos objetivos conforme suas porcentagens configuradas.</p>
                  </div>
                </div>

                {/* botões */}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 h-12 text-white/60 font-medium hover:bg-white/5 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 h-12 bg-[#cbfb46] text-black font-bold rounded-xl hover:bg-[#b8e63e] transition-all shadow-[0_0_20px_rgba(203,251,70,0.2)]">
                    Criar Conta
                  </button>
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