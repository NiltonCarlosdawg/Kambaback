// src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle, Info, LayoutDashboard, Lock, Plus, RefreshCw, TrendingDown, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Objetivo { id: string; titulo: string; valorAtual: number | string; valorAlvo: number | string; cor?: string; porcentagemDistribuicao?: number; dataPrevista?: string; }
interface Gasto { id: string; tipo: 'DESPESA' | 'RECEITA'; valor: number | string; descricao: string; data: string; excluido: boolean; distribuicaoAutomatica?: boolean; categoria?: { nome: string }; cartao?: { nome: string }; objetivo?: { titulo: string }; }
interface Alerta { tipo: 'perigo' | 'aviso' | 'info'; titulo: string; mensagem: string; valor?: number; }
interface DashboardData { success?: boolean; saldos?: { total: number; disponivel: number; reservado: number }; esteMes: { receitas: number; despesas: number; poupancaLiquida: number; taxaPoupanca?: number }; resumo?: { totalAlvo?: number; totalAtual?: number; progressoGeral?: number }; objetivos?: Objetivo[]; fundoEmergencia?: { mesesCobertos: number; percentualAtingido: number }; alertas: Alerta[]; cached?: boolean; }

// ─── Shared inline components ─────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
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

// ─── Component ────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { formatMoney, maskValue, formatDate, prefs } = useTheme();

  const [data,               setData]               = useState<DashboardData | null>(null);
  const [objetivos,          setObjetivos]          = useState<Objetivo[]>([]);
  const [ultimasTransacoes,  setUltimasTransacoes]  = useState<Gasto[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [refreshing,         setRefreshing]         = useState(false);
  const [error,              setError]              = useState('');
  const [valoresCalculados,  setValoresCalculados]  = useState({ patrimonioTotal: 0, saldoDisponivel: 0, saldoReservado: 0, emObjetivos: 0, emCartoes: 0 });

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true); setError('');
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
      setData(dadosDashboard); calcularValores(dadosDashboard, objetivosData);
    } catch { setError('Falha ao carregar dados.'); try { await fetchFallbackData(); } catch { /* silent */ } }
    finally { setLoading(false); setRefreshing(false); }
  };

  const calcularValores = (dashData: DashboardData, objs: Objetivo[]) => {
    const emCartoes = dashData.saldos?.total || 0;
    const emObjetivos = objs.reduce((a, o) => a + Number(o.valorAtual || 0), 0);
    setValoresCalculados({ patrimonioTotal: emCartoes + emObjetivos, saldoDisponivel: dashData.saldos?.disponivel || 0, saldoReservado: dashData.saldos?.reservado || 0, emObjetivos, emCartoes });
  };

  const fetchFallbackData = async (objsData?: Objetivo[]) => {
    const [cartoesRes, gastosRes, objRes] = await Promise.all([api.get('/cartoes'), api.get('/gastos'), !objsData ? api.get('/objetivos') : Promise.resolve({ data: { objetivos: objsData } })]);
    const cartoes = cartoesRes.data?.cartoes || [], gastos = gastosRes.data?.gastos || [], objs = objRes.data?.objetivos || objRes.data || [];
    const emCartoes = cartoes.reduce((a: number, c: any) => a + Number(c.saldoAtual || 0), 0);
    const saldoDisponivel = cartoes.reduce((a: number, c: any) => a + Number(c.saldoDisponivel || c.saldoAtual || 0), 0);
    const saldoReservado  = cartoes.reduce((a: number, c: any) => a + Number(c.saldoReservado || 0), 0);
    const emObjetivos = objs.reduce((a: number, o: any) => a + Number(o.valorAtual || 0), 0);
    const hoje = new Date(), primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const gastosDoMes = gastos.filter((g: Gasto) => !g.excluido && new Date(g.data) >= primeiroDia);
    const receitas = gastosDoMes.filter((g: Gasto) => g.tipo === 'RECEITA').reduce((a: number, g: Gasto) => a + Number(g.valor), 0);
    const despesas = gastosDoMes.filter((g: Gasto) => g.tipo === 'DESPESA').reduce((a: number, g: Gasto) => a + Number(g.valor), 0);
    const poupancaLiquida = receitas - despesas;
    setData({ saldos: { total: emCartoes, disponivel: saldoDisponivel, reservado: saldoReservado }, esteMes: { receitas, despesas, poupancaLiquida, taxaPoupanca: receitas > 0 ? (poupancaLiquida / receitas) * 100 : 0 }, resumo: { totalAlvo: objs.reduce((a: number, o: any) => a + Number(o.valorAlvo || 0), 0), totalAtual: emObjetivos }, objetivos: objs, alertas: despesas > receitas * 0.8 ? [{ tipo: 'perigo', titulo: 'Gastos Elevados', mensagem: 'Já gastaste mais de 80% das tuas receitas!' }] : [] });
    setValoresCalculados({ patrimonioTotal: emCartoes + emObjetivos, saldoDisponivel, saldoReservado, emObjetivos, emCartoes });
    setObjetivos(objs.slice(0, 3)); setUltimasTransacoes(gastos.slice(0, 5));
  };

  useEffect(() => { fetchData(); const i = setInterval(() => { if (document.visibilityState === 'visible') fetchData(false); }, 30000); return () => clearInterval(i); }, []);

  const getDiasRestantes = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

  const getAlertStyle = (tipo: string): React.CSSProperties => {
    if (tipo === 'perigo') return { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' };
    if (tipo === 'aviso')  return { backgroundColor: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.2)',  color: '#facc15' };
    return                        { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', color: '#60a5fa' };
  };

  const getAlertIcon = (tipo: string) => {
    if (tipo === 'perigo') return <AlertCircle size={18} className="flex-shrink-0" />;
    if (tipo === 'aviso')  return <AlertCircle size={18} className="flex-shrink-0" />;
    return <Info size={18} className="flex-shrink-0" />;
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>A carregar os teus dados…</p>
      </div>
    </div>
  );

  if (error && !data) return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <AlertCircle size={40} style={{ color: '#f87171' }} />
      <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>{error}</p>
      <button onClick={() => fetchData()}
        className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02]"
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
    { name: 'Receitas', value: Math.abs(data.esteMes.receitas),  color: prefs.accentColor },
    { name: 'Despesas', value: Math.abs(data.esteMes.despesas),  color: '#ef4444'         },
  ].filter(i => i.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Visão Geral</p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Resumo do teu patrimônio
            {data.cached && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset"
              style={{ color: 'var(--text-faint)', backgroundColor: 'var(--bg-elevated)', ringColor: 'var(--border)' }}>cache</span>}
          </p>
        </div>
        <button onClick={() => fetchData(false)} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50 transition-all border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; (e.currentTarget).style.borderColor = 'var(--accent-20)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-muted)'; (e.currentTarget).style.borderColor = 'var(--border)'; }}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      {/* Alerts */}
      {data.alertas?.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border text-sm" style={getAlertStyle(a.tipo)}>
              {getAlertIcon(a.tipo)}
              <div className="flex-1">
                <span className="font-bold">{a.titulo}</span>
                <span className="opacity-80 ml-1.5">{a.mensagem}</span>
              </div>
              {a.valor && <span className="text-xl font-bold opacity-40">{a.valor}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Patrimônio Total */}
        <Card className="md:col-span-2" style={{ padding: '20px 24px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Patrimônio Total</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {maskValue(formatMoney(patrimonioTotal))}
              </h3>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', ringColor: 'var(--border)' }}>
                  {maskValue(formatMoney(emCartoes))} cartões
                </span>
                {temInvestimentos && (
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset"
                    style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-10)', ringColor: 'var(--accent-20)' }}>
                    +{maskValue(formatMoney(emObjetivos))} objetivos
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Disponível */}
        <Card style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset"
              style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#10b981', ringColor: 'rgba(16,185,129,0.2)' }}>
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Disponível</p>
              <h3 className="text-xl font-bold truncate text-emerald-400 mt-0.5">{maskValue(formatMoney(saldoDisponivel))}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                {emCartoes > 0 ? ((saldoDisponivel / emCartoes) * 100).toFixed(0) : 0}% dos cartões
              </p>
            </div>
          </div>
        </Card>

        {/* Comprometido */}
        <Card style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#f59e0b', ringColor: 'rgba(245,158,11,0.2)' }}>
              <Lock size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Comprometido</p>
              <h3 className="text-xl font-bold truncate text-amber-400 mt-0.5">{maskValue(formatMoney(saldoReservado + emObjetivos))}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>reservado + objetivos</p>
            </div>
          </div>
        </Card>

        {/* Receitas */}
        <Card style={{ padding: '20px 24px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Receitas (Mês)</p>
          <h3 className="text-2xl font-bold tracking-tight mt-1.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>
            {maskValue(formatMoney(data.esteMes.receitas))}
          </h3>
          <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
            <TrendingUp size={14} /> Entradas do mês
          </div>
        </Card>

        {/* Despesas */}
        <Card style={{ padding: '20px 24px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Despesas (Mês)</p>
          <h3 className="text-2xl font-bold tracking-tight mt-1.5 mb-1.5" style={{ color: 'var(--text-primary)' }}>
            {maskValue(formatMoney(data.esteMes.despesas))}
          </h3>
          <div className="flex items-center gap-1 text-[11px] font-bold text-red-400">
            <TrendingDown size={14} /> Saídas do mês
          </div>
        </Card>

        {/* Resultado */}
        <Card style={{ padding: '20px 24px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Resultado</p>
          <h3 className={`text-2xl font-bold tracking-tight mt-1.5 mb-1.5 ${data.esteMes.poupancaLiquida >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {maskValue(formatMoney(data.esteMes.poupancaLiquida))}
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Taxa: {Math.abs(taxaPoupanca).toFixed(1)}%</p>
        </Card>

        {/* Taxa Poupança */}
        <Card style={{ padding: '20px 24px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.7 }}>Poupança</p>
          <div className="flex items-end gap-3 mt-1.5">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none"
                  stroke={taxaPoupanca >= 20 ? 'var(--accent)' : taxaPoupanca >= 0 ? '#3b82f6' : '#f43f5e'}
                  strokeWidth="4"
                  strokeDasharray={`${Math.min(Math.max(taxaPoupanca, 0), 100) / 100 * 113} 113`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 600ms' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {maskValue(`${Math.abs(taxaPoupanca).toFixed(0)}%`)}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: taxaPoupanca >= 20 ? 'var(--accent)' : taxaPoupanca >= 0 ? '#60a5fa' : '#f87171' }}>
                {taxaPoupanca >= 20 ? '✅ Excelente' : taxaPoupanca >= 10 ? '⚠️ Razoável' : '❌ Baixa'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>meta: 20%+</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Ações Rápidas</p>
        <div className="flex flex-wrap gap-3">
          {[
            { Icon: ArrowUp,         label: 'Receita'   },
            { Icon: ArrowDown,        label: 'Despesa'   },
            { Icon: ArrowLeftRight,   label: 'Swap'      },
            { Icon: Trophy,           label: 'Objetivos' },
            { Icon: Plus,              label: 'Mais'      },
          ].map(({ Icon, label }, idx) => (
            <button key={idx} className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center transition-all border"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--accent)'; (e.currentTarget).style.color = 'var(--accent-text)'; (e.currentTarget).style.borderColor = 'transparent'; (e.currentTarget).style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-surface)'; (e.currentTarget).style.color = 'var(--text-muted)'; (e.currentTarget).style.borderColor = 'var(--border)'; (e.currentTarget).style.transform = 'scale(1)'; }}>
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts + Objetivos + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Revenue chart */}
          <Card>
            <SectionHeader title="Revenue Flow" subtitle="Comparativo mensal" />
            <div className="p-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-faint)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => maskValue(formatMoney(v))}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6,6,0,0]} barSize={50}>
                    {chartData.map((entry, i) => <Cell key={i} fill={i === 0 ? prefs.accentColor : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Objetivos */}
          {objetivos.length > 0 && (
            <Card>
              <SectionHeader title="Progresso dos Objetivos" subtitle="Metas activas" />
              <div className="p-5 space-y-5">
                {objetivos.map(obj => {
                  const valorAtual = Number(obj.valorAtual), valorAlvo = Number(obj.valorAlvo);
                  const progresso = Math.min((valorAtual / valorAlvo) * 100, 100);
                  const diasRestantes = getDiasRestantes(obj.dataPrevista);
                  return (
                    <div key={obj.id}>
                      <div className="flex justify-between mb-2 items-start">
                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</span>
                          {progresso >= 100 && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                              style={{ color: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', ringColor: 'rgba(16,185,129,0.2)' }}>Concluído</span>
                          )}
                          {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 30 && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                              style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', ringColor: 'rgba(245,158,11,0.2)' }}>{diasRestantes}d</span>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{maskValue(formatMoney(valorAtual))}</div>
                          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>de {maskValue(formatMoney(valorAlvo))}</div>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progresso}%`, backgroundColor: obj.cor || 'var(--accent)' }} />
                      </div>
                      <div className="flex justify-between mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        <span>{progresso.toFixed(0)}%</span>
                        <span>Faltam {maskValue(formatMoney(Math.max(0, valorAlvo - valorAtual)))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <SectionHeader title="Últimas Movimentações" subtitle="Actividade recente" />
            {ultimasTransacoes.length === 0 ? (
              <div className="p-10 text-center">
                <ArrowLeftRight size={30} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Sem movimentações</p>
              </div>
            ) : (
              <div>
                {ultimasTransacoes.map(t => {
                  const isReceita = t.tipo === 'RECEITA', valor = Number(t.valor);
                  return (
                    <div key={t.id}
                      className="flex items-center gap-3 px-4 py-3.5 group cursor-pointer transition-all"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset"
                        style={{
                          backgroundColor: isReceita ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          color: isReceita ? '#10b981' : '#f87171',
                          ringColor: isReceita ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        }}>
                        {isReceita ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t.descricao || (isReceita ? 'Receita' : 'Despesa')}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{t.categoria?.nome || 'Geral'} · {formatDate(t.data)}</p>
                      </div>
                      <p className="text-sm font-bold flex-shrink-0" style={{ color: isReceita ? '#10b981' : 'var(--text-primary)' }}>
                        {isReceita ? '+' : '-'}{maskValue(formatMoney(valor, true))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;