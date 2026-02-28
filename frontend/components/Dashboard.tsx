// src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Objetivo {
  id: string;
  titulo: string;
  valorAtual: number | string;
  valorAlvo: number | string;
  cor?: string;
  porcentagemDistribuicao?: number;
  dataPrevista?: string;
}

interface Gasto {
  id: string;
  tipo: 'DESPESA' | 'RECEITA';
  valor: number | string;
  descricao: string;
  data: string;
  excluido: boolean;
  distribuicaoAutomatica?: boolean;
  categoria?: { nome: string };
  cartao?: { nome: string };
  objetivo?: { titulo: string };
}

interface Alerta {
  tipo: 'perigo' | 'aviso' | 'info';
  titulo: string;
  mensagem: string;
  valor?: number;
}

interface DashboardData {
  success?: boolean;
  saldos?: { total: number; disponivel: number; reservado: number };
  esteMes: { receitas: number; despesas: number; poupancaLiquida: number; taxaPoupanca?: number };
  resumo?: { totalAlvo?: number; totalAtual?: number; progressoGeral?: number };
  objetivos?: Objetivo[];
  fundoEmergencia?: { mesesCobertos: number; percentualAtingido: number };
  alertas: Alerta[];
  cached?: boolean;
}

const Dashboard: React.FC = () => {
  const { formatMoney, maskValue, formatDate, prefs } = useTheme();

  const [data,               setData]               = useState<DashboardData | null>(null);
  const [objetivos,          setObjetivos]          = useState<Objetivo[]>([]);
  const [ultimasTransacoes,  setUltimasTransacoes]  = useState<Gasto[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [refreshing,         setRefreshing]         = useState(false);
  const [error,              setError]              = useState('');
  const [valoresCalculados,  setValoresCalculados]  = useState({
    patrimonioTotal: 0, saldoDisponivel: 0, saldoReservado: 0, emObjetivos: 0, emCartoes: 0,
  });

  // ── fetch ──────────────────────────────────────────────────
  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      const [dashRes, objRes, transRes] = await Promise.all([
        api.get('/insights/resumo').catch(() => ({ data: null })),
        api.get('/objetivos'),
        api.get('/gastos?limite=5'),
      ]);
      const objetivosData = objRes.data?.objetivos || objRes.data || [];
      setObjetivos(objetivosData.slice(0, 3));
      setUltimasTransacoes((transRes.data?.gastos || transRes.data?.transacoes || []).slice(0, 5));
      const dadosDashboard = dashRes.data?.success ? dashRes.data : dashRes.data;
      if (!dadosDashboard) { await fetchFallbackData(objetivosData); return; }
      setData(dadosDashboard);
      calcularValores(dadosDashboard, objetivosData);
    } catch {
      setError('Falha ao carregar dados.');
      try { await fetchFallbackData(); } catch { /* silent */ }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calcularValores = (dashData: DashboardData, objs: Objetivo[]) => {
    const emCartoes = dashData.saldos?.total || 0;
    const emObjetivos = objs.reduce((a, o) => a + Number(o.valorAtual || 0), 0);
    setValoresCalculados({
      patrimonioTotal: emCartoes + emObjetivos,
      saldoDisponivel: dashData.saldos?.disponivel || 0,
      saldoReservado:  dashData.saldos?.reservado  || 0,
      emObjetivos,
      emCartoes,
    });
  };

  const fetchFallbackData = async (objsData?: Objetivo[]) => {
    const [cartoesRes, gastosRes, objRes] = await Promise.all([
      api.get('/cartoes'),
      api.get('/gastos'),
      !objsData ? api.get('/objetivos') : Promise.resolve({ data: { objetivos: objsData } }),
    ]);
    const cartoes = cartoesRes.data?.cartoes || [];
    const gastos  = gastosRes.data?.gastos  || [];
    const objs    = objRes.data?.objetivos  || objRes.data || [];
    const emCartoes = cartoes.reduce((a: number, c: any) => a + Number(c.saldoAtual || 0), 0);
    const saldoDisponivel = cartoes.reduce((a: number, c: any) => a + Number(c.saldoDisponivel || c.saldoAtual || 0), 0);
    const saldoReservado  = cartoes.reduce((a: number, c: any) => a + Number(c.saldoReservado || 0), 0);
    const emObjetivos = objs.reduce((a: number, o: any) => a + Number(o.valorAtual || 0), 0);
    const hoje = new Date(), primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const gastosDoMes = gastos.filter((g: Gasto) => !g.excluido && new Date(g.data) >= primeiroDia);
    const receitas  = gastosDoMes.filter((g: Gasto) => g.tipo === 'RECEITA').reduce((a: number, g: Gasto) => a + Number(g.valor), 0);
    const despesas  = gastosDoMes.filter((g: Gasto) => g.tipo === 'DESPESA').reduce((a: number, g: Gasto) => a + Number(g.valor), 0);
    const poupancaLiquida = receitas - despesas;
    setData({
      saldos: { total: emCartoes, disponivel: saldoDisponivel, reservado: saldoReservado },
      esteMes: { receitas, despesas, poupancaLiquida, taxaPoupanca: receitas > 0 ? (poupancaLiquida / receitas) * 100 : 0 },
      resumo: { totalAlvo: objs.reduce((a: number, o: any) => a + Number(o.valorAlvo || 0), 0), totalAtual: emObjetivos },
      objetivos: objs,
      alertas: despesas > receitas * 0.8 ? [{ tipo: 'perigo', titulo: 'Gastos Elevados', mensagem: 'Já gastaste mais de 80% das tuas receitas!' }] : [],
    });
    setValoresCalculados({ patrimonioTotal: emCartoes + emObjetivos, saldoDisponivel, saldoReservado, emObjetivos, emCartoes });
    setObjetivos(objs.slice(0, 3));
    setUltimasTransacoes(gastos.slice(0, 5));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') fetchData(false); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDiasRestantes = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  const getAlertStyle = (tipo: string): React.CSSProperties => {
    if (tipo === 'perigo') return { background: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.25)',  color: '#f87171' };
    if (tipo === 'aviso')  return { background: 'rgba(234,179,8,0.1)',  border: '1px solid rgba(234,179,8,0.25)',  color: '#facc15' };
    return                        { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' };
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>A carregar os teus dados financeiros…</p>
      </div>
    </div>
  );

  if (error && !data) return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-red-400 text-center">{error}</p>
      <button onClick={() => fetchData()}
        className="px-6 py-2 rounded-full flex items-center gap-2 font-bold transition-all"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
        Tentar Novamente
      </button>
    </div>
  );

  if (!data) return null;

  const { patrimonioTotal, saldoDisponivel, saldoReservado, emObjetivos, emCartoes } = valoresCalculados;
  const taxaPoupanca = data.esteMes.taxaPoupanca ?? (data.esteMes.receitas > 0 ? (data.esteMes.poupancaLiquida / data.esteMes.receitas) * 100 : 0);
  const temInvestimentos = emObjetivos > 1000;
  const chartData = [
    { name: 'Receitas', value: Math.abs(data.esteMes.receitas), color: 'var(--accent)' },
    { name: 'Despesas', value: Math.abs(data.esteMes.despesas), color: '#ef4444' },
  ].filter(i => i.value > 0);

  // ── Card base style ────────────────────────────────────────
  const card: React.CSSProperties = {
    background:   'var(--bg-surface)',
    border:       '1px solid var(--border)',
    borderRadius: '16px',
    padding:      '24px',
  };

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Resumo completo do teu patrimônio</p>
          {data.cached && (
            <span className="text-xs px-2 py-1 rounded mt-1 inline-block" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)' }}>
              Dados em cache
            </span>
          )}
        </div>
        <button onClick={() => fetchData(false)} disabled={refreshing}
          className="flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      {/* Alerts */}
      {data.alertas?.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <div key={i} className="p-4 rounded-xl flex items-center gap-3" style={getAlertStyle(a.tipo)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-bold">{a.titulo}</h4>
                <p className="text-sm opacity-90">{a.mensagem}</p>
              </div>
              {a.valor && <span className="text-2xl font-bold opacity-50">{a.valor}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Patrimônio Total */}
        <div className="md:col-span-2 relative overflow-hidden group" style={{ ...card }}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Patrimônio Total</p>
              <h3 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                {maskValue(formatMoney(patrimonioTotal))}
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                  {maskValue(formatMoney(emCartoes))} em cartões
                </span>
                {temInvestimentos && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--accent-10)', color: 'var(--accent)' }}>
                    +{maskValue(formatMoney(emObjetivos))} em objetivos
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Disponível */}
        <div className="relative overflow-hidden group" style={card}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl flex-shrink-0 bg-emerald-500/20 text-emerald-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Disponível</p>
              <h3 className="text-xl font-bold text-emerald-400 truncate">{maskValue(formatMoney(saldoDisponivel))}</h3>
              <p className="text-xs text-emerald-500/60 mt-1">{emCartoes > 0 ? ((saldoDisponivel / emCartoes) * 100).toFixed(0) : 0}% dos cartões</p>
            </div>
          </div>
        </div>

        {/* Comprometido */}
        <div className="relative overflow-hidden group" style={card}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-orange-500 to-red-600 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl flex-shrink-0 bg-orange-500/20 text-orange-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Comprometido</p>
              <h3 className="text-xl font-bold text-orange-400 truncate">{maskValue(formatMoney(saldoReservado + emObjetivos))}</h3>
            </div>
          </div>
        </div>

        {/* Receitas */}
        <div className="relative overflow-hidden group" style={card}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity" />
          <div className="relative">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Receitas (Mês)</p>
            <h3 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              {maskValue(formatMoney(data.esteMes.receitas))}
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--accent)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              Entradas
            </div>
          </div>
        </div>

        {/* Despesas */}
        <div className="relative overflow-hidden group" style={card}>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-red-500 to-pink-600 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity" />
          <div className="relative">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Despesas (Mês)</p>
            <h3 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              {maskValue(formatMoney(data.esteMes.despesas))}
            </h3>
            <div className="flex items-center gap-1 text-red-400 text-xs font-bold">
              <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              Saídas
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="relative overflow-hidden group" style={card}>
          <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${data.esteMes.poupancaLiquida >= 0 ? 'from-emerald-500 to-green-600' : 'from-red-500 to-pink-600'} rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity`} />
          <div className="relative">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Resultado do Mês</p>
            <h3 className={`text-3xl font-black tracking-tight mb-2 ${data.esteMes.poupancaLiquida >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {maskValue(formatMoney(data.esteMes.poupancaLiquida))}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Taxa: {Math.abs(taxaPoupanca).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--accent)' }}>
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          Quick Actions
        </h4>
        <div className="flex flex-wrap gap-4">
          {[
            { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Send' },
            { icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', label: 'Receive' },
            { icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4', label: 'Swap' },
            { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Goals' },
            { icon: 'M12 4v16m8-8H4', label: 'More' },
          ].map((action, idx) => (
            <button key={idx} className="flex flex-col items-center gap-2 group">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.backgroundColor = 'var(--accent)';
                  el.style.color = 'var(--accent-text)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.backgroundColor = 'var(--bg-elevated)';
                  el.style.color = 'var(--text-muted)';
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-faint)' }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts + Objetivos + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Flow */}
          <div style={card}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Revenue Flow</h4>
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Comparativo do mês atual</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-faint)', fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => maskValue(formatMoney(v))}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={i === 0 ? prefs.accentColor : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Objetivos */}
          {objetivos.length > 0 && (
            <div style={card}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Progresso dos Objetivos
                </h3>
              </div>
              <div className="space-y-6">
                {objetivos.map(obj => {
                  const valorAtual = Number(obj.valorAtual), valorAlvo = Number(obj.valorAlvo);
                  const progresso = Math.min((valorAtual / valorAlvo) * 100, 100);
                  const diasRestantes = getDiasRestantes(obj.dataPrevista);
                  return (
                    <div key={obj.id}>
                      <div className="flex justify-between mb-2 items-start">
                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</span>
                          {progresso >= 100 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Concluído</span>
                          )}
                          {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 30 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{diasRestantes}d</span>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(valorAtual))}</div>
                          <div className="text-xs" style={{ color: 'var(--text-faint)' }}>de {maskValue(formatMoney(valorAlvo))}</div>
                        </div>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progresso}%`, backgroundColor: obj.cor || 'var(--accent)' }} />
                      </div>
                      <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
                        <span>{progresso.toFixed(0)}%</span>
                        <span>Faltam {maskValue(formatMoney(Math.max(0, valorAlvo - valorAtual)))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Últimas Movimentações</h4>
            <span className="text-xs font-bold uppercase cursor-pointer" style={{ color: 'var(--accent)' }}>Ver todas</span>
          </div>
          <div className="space-y-3">
            {ultimasTransacoes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl" style={{ ...card }}>
                <p style={{ color: 'var(--text-faint)' }}>Sem movimentações recentes</p>
              </div>
            ) : ultimasTransacoes.map(t => {
              const isReceita = t.tipo === 'RECEITA', valor = Number(t.valor);
              return (
                <div key={t.id}
                  className="p-4 rounded-2xl flex items-center justify-between group cursor-pointer transition-all"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isReceita ? 'var(--accent-10)' : 'rgba(239,68,68,0.1)', color: isReceita ? 'var(--accent)' : '#f87171' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isReceita
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13l5 5m0 0l5-5m-5 5V6" />
                        }
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{t.descricao || (isReceita ? 'Receita' : 'Despesa')}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                        {t.categoria?.nome || 'Geral'} · {formatDate(t.data)}
                      </p>
                    </div>
                  </div>
                  <p className="font-black text-sm flex-shrink-0 ml-3" style={{ color: isReceita ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {isReceita ? '+' : '-'}{maskValue(formatMoney(valor, true))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;