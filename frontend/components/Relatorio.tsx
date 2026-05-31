// src/components/Relatorio.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart2, TrendingUp, TrendingDown, PiggyBank, Target,
  RefreshCw, Calendar, Layers, AlertCircle, Loader2,
  ArrowUpRight, ArrowDownRight, Award, Flame
} from 'lucide-react';
import dashboardService from '../services/dashboardService';

// ==========================================
// Types
// ==========================================
type Periodo = '7dias' | '31dias' | 'trimestre' | 'semestre' | 'anual';

interface PeriodoItem {
  periodo: string;
  receitas: number;
  despesas: number;
  poupancaLiquida: number;
  taxaPoupanca: number;
}

interface TopCategoria {
  categoria: string;
  cor: string;
  valor: number;
  quantidade: number;
  porcentagem: number;
}

interface DashboardData {
  esteMes: {
    receitas: number;
    despesas: number;
    poupancaLiquida: number;
    taxaPoupanca: number;
  };
  saldos?: { total: number; disponivel: number; reservado: number };
}

// ==========================================
// Configuração dos Períodos
// ==========================================
const PERIODOS_CONFIG: { valor: Periodo; label: string; descricao: string }[] = [
  { valor: '7dias', label: '7D', descricao: 'Últimos 7 dias' },
  { valor: '31dias', label: '31D', descricao: 'Últimos 31 dias' },
  { valor: 'trimestre', label: '3M', descricao: 'Último trimestre' },
  { valor: 'semestre', label: '6M', descricao: 'Último semestre' },
  { valor: 'anual', label: '1A', descricao: 'Último ano' },
];

// ==========================================
// Helpers
// ==========================================
const fmt = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M Kz`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K Kz`;
  return `${v.toFixed(0)} Kz`;
};

const fmtFull = (v: number) =>
  v?.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' Kz';

const CORES = ['#cbfb46', '#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'];

// ==========================================
// Custom Tooltip
// ==========================================
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F1318] border border-white/10 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-white/50 text-xs font-bold mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold flex items-center justify-between gap-3" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ==========================================
// KPI Card
// ==========================================
const KpiCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  positive?: boolean | null;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = ({ label, value, sub, icon: Icon, positive, colorClass, bgClass, borderClass }) => (
  <div className={`${bgClass} border ${borderClass} rounded-2xl p-5 flex flex-col gap-3`}>
    <div className={`w-9 h-9 ${bgClass} rounded-xl flex items-center justify-center border ${borderClass}`}>
      <Icon className={`w-4 h-4 ${colorClass}`} />
    </div>
    <div>
      <div className="flex items-end gap-1.5">
        <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
        {positive !== null && positive !== undefined && (
          positive
            ? <ArrowUpRight className="w-4 h-4 text-green-400 mb-0.5" />
            : <ArrowDownRight className="w-4 h-4 text-red-400 mb-0.5" />
        )}
      </div>
      <p className="text-white/40 text-xs font-bold mt-0.5">{label}</p>
      {sub && <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ==========================================
// Main Component
// ==========================================
const Relatorio: React.FC = () => {
  const [historico, setHistorico] = useState<PeriodoItem[]>([]);
  const [topCategorias, setTopCategorias] = useState<TopCategoria[]>([]);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('semestre');
  const [resumoPeriodo, setResumoPeriodo] = useState<any>(null);

  const fetchTudo = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [dataHistorico, dataTop, dataDash] = await Promise.all([
        dashboardService.obterHistorico(periodo),
        dashboardService.obterTopCategorias(),
        dashboardService.obterResumoDashboard(),
      ]);

      if (dataHistorico.success) {
        setHistorico(dataHistorico.historico || []);
        setResumoPeriodo(dataHistorico.resumo);
      }
      if (dataTop.success) setTopCategorias(dataTop.top || []);
      if (dataDash.success) setDashData(dataDash);
    } catch (e: any) {
      setError('Erro ao carregar relatório. Verifica a ligação.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => { fetchTudo(); }, [fetchTudo]);

  const exportCSV = () => {
    if (!historico.length) return;
    const headers = ['Período', 'Receitas', 'Despesas', 'Poupanca Liquida', 'Taxa Poupanca (%)'];
    const rows = historico.map(h => [
      h.periodo,
      h.receitas,
      h.despesas,
      h.poupancaLiquida,
      h.taxaPoupanca?.toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio-${periodo}-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const esteMes = dashData?.esteMes;
  const totalGastoCategorias = topCategorias.reduce((a, c) => a + c.valor, 0);
  const melhorMes = historico.length > 0 ? historico.reduce((a, b) => a.poupancaLiquida > b.poupancaLiquida ? a : b) : null;
  const piorMes = historico.length > 0 ? historico.reduce((a, b) => a.poupancaLiquida < b.poupancaLiquida ? a : b) : null;

  // Label do período atual para exibição
  const periodoAtual = PERIODOS_CONFIG.find(p => p.valor === periodo);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 text-[#cbfb46] animate-spin" />
        <p className="text-white/40 text-sm font-medium">A carregar relatório...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-white font-bold">{error}</p>
        <button onClick={() => fetchTudo()} className="px-5 py-2.5 bg-[#cbfb46] text-black text-sm font-black rounded-xl hover:bg-[#b8e63e] transition-all flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-[#cbfb46]/10 border border-[#cbfb46]/20 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-[#cbfb46]" />
            </div>
            Relatório Financeiro
          </h2>
          <p className="text-white/40 text-sm mt-1 ml-[52px]">
            {periodoAtual?.descricao || 'Visão detalhada das tuas finanças'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector - 5 opções */}
          <div className="flex gap-1 p-1.5 bg-white/[0.03] rounded-2xl border border-white/10">
            {PERIODOS_CONFIG.map((p) => (
              <button 
                key={p.valor} 
                onClick={() => setPeriodo(p.valor)}
                title={p.descricao}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  periodo === p.valor 
                    ? 'bg-[#cbfb46] text-black' 
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button 
            onClick={() => fetchTudo(true)} 
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs do Período Selecionado */}
      {resumoPeriodo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            label={`Receitas (${periodoAtual?.label})`} 
            value={fmt(resumoPeriodo.totalReceitas)} 
            icon={TrendingUp}
            positive={true} 
            colorClass="text-green-400" 
            bgClass="bg-green-500/5" 
            borderClass="border-green-500/15" 
          />
          <KpiCard 
            label={`Despesas (${periodoAtual?.label})`} 
            value={fmt(resumoPeriodo.totalDespesas)} 
            icon={TrendingDown}
            positive={false} 
            colorClass="text-red-400" 
            bgClass="bg-red-500/5" 
            borderClass="border-red-500/15" 
          />
          <KpiCard 
            label="Poupança líquida" 
            value={fmt(resumoPeriodo.totalPoupanca)}
            icon={PiggyBank} 
            positive={resumoPeriodo.totalPoupanca >= 0} 
            colorClass="text-[#cbfb46]"
            bgClass="bg-[#cbfb46]/5" 
            borderClass="border-[#cbfb46]/15" 
          />
          <KpiCard 
            label="Taxa de poupança" 
            value={`${resumoPeriodo.taxaPoupancaMedia?.toFixed(1) || 0}%`}
            sub={resumoPeriodo.taxaPoupancaMedia >= 20 ? 'Meta de 20% atingida!' : `Objetivo: 20%`}
            icon={Target} 
            colorClass="text-blue-400" 
            bgClass="bg-blue-500/5" 
            borderClass="border-blue-500/15" 
          />
        </div>
      )}

      {/* KPIs do Mês Atual (sempre visíveis) */}
      {esteMes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-3">Este Mês</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Receitas" value={fmt(esteMes.receitas)} icon={TrendingUp}
              positive={true} colorClass="text-green-400" bgClass="bg-transparent" borderClass="border-white/5" />
            <KpiCard label="Despesas" value={fmt(esteMes.despesas)} icon={TrendingDown}
              positive={false} colorClass="text-red-400" bgClass="bg-transparent" borderClass="border-white/5" />
            <KpiCard label="Poupança" value={fmt(esteMes.poupancaLiquida)}
              icon={PiggyBank} positive={esteMes.poupancaLiquida >= 0} colorClass="text-[#cbfb46]"
              bgClass="bg-transparent" borderClass="border-white/5" />
            <KpiCard label="Taxa" value={`${esteMes.taxaPoupanca?.toFixed(1) || 0}%`}
              icon={Target} colorClass="text-blue-400" bgClass="bg-transparent" borderClass="border-white/5" />
          </div>
        </div>
      )}

      {/* Highlights */}
      {historico.length > 0 && (melhorMes || piorMes) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {melhorMes && (
            <div className="flex items-start gap-4 p-5 bg-green-500/5 border border-green-500/15 rounded-2xl">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Melhor Mês</p>
                <p className="text-white font-black mt-1">{melhorMes.periodo}</p>
                <p className="text-green-400 font-bold text-sm">{fmtFull(melhorMes.poupancaLiquida)}</p>
                <p className="text-white/30 text-xs">Taxa: {melhorMes.taxaPoupanca?.toFixed(0)}%</p>
              </div>
            </div>
          )}
          {piorMes && (
            <div className="flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/15 rounded-2xl">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Mês Mais Desafiante</p>
                <p className="text-white font-black mt-1">{piorMes.periodo}</p>
                <p className={`font-bold text-sm ${piorMes.poupancaLiquida < 0 ? 'text-red-400' : 'text-yellow-400'}`}>{fmtFull(piorMes.poupancaLiquida)}</p>
                <p className="text-white/30 text-xs">Taxa: {piorMes.taxaPoupanca?.toFixed(0)}%</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Area Chart — Evolução */}
      {historico.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-black text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#cbfb46]" />
              Evolução {periodoAtual?.descricao}
            </h3>
            <span className="text-white/30 text-xs">{historico.length} meses</span>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={historico} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#cbfb46" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#cbfb46" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="periodo" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, paddingTop: 16 }} />
              <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#cbfb46" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 4, fill: '#cbfb46' }} />
              <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#f43f5e" strokeWidth={2} fill="url(#gD)" dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-dashed border-white/10 rounded-3xl p-12 text-center">
          <BarChart2 className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-bold">Sem histórico disponível</p>
          <p className="text-white/25 text-sm mt-1">Adiciona transações para ver a evolução</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart — Poupança */}
        {historico.length > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
            <h3 className="text-white font-black text-base flex items-center gap-2 mb-6">
              <PiggyBank className="w-4 h-4 text-[#cbfb46]" /> Poupança por Mês
            </h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={historico} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="periodo" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="poupancaLiquida" name="Poupança" radius={[6, 6, 0, 0]}>
                  {historico.map((entry, i) => (
                    <Cell key={i} fill={entry.poupancaLiquida >= 0 ? '#cbfb46' : '#f43f5e'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie — Categorias */}
        {topCategorias.length > 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
            <h3 className="text-white font-black text-base flex items-center gap-2 mb-6">
              <Layers className="w-4 h-4 text-[#cbfb46]" /> Despesas por Categoria
            </h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={210}>
                <PieChart>
                  <Pie data={topCategorias} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="valor" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {topCategorias.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtFull(v)}
                    contentStyle={{ background: '#0F1318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    itemStyle={{ color: 'white' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5 overflow-auto max-h-[210px] pr-1">
                {topCategorias.map((cat, i) => (
                  <div key={cat.categoria} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CORES[i % CORES.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-xs truncate">{cat.categoria}</p>
                      <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.porcentagem}%`, background: CORES[i % CORES.length] }} />
                      </div>
                    </div>
                    <span className="text-white text-xs font-black flex-shrink-0">{cat.porcentagem?.toFixed(0)}%</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-white/30 text-xs">Total: {fmtFull(totalGastoCategorias)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-3">
            <Layers className="w-8 h-8 text-white/20" />
            <p className="text-white/40 font-bold text-sm">Sem dados de categorias</p>
          </div>
        )}
      </div>

      {/* Tabela de histórico */}
      {historico.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-black text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#cbfb46]" /> Histórico Detalhado
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent-20)' }}
              >
                Exportar CSV
              </button>
              <span className="text-white/30 text-xs">{periodoAtual?.descricao}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {['Período', 'Receitas', 'Despesas', 'Poupança', 'Taxa'].map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-black text-white/30 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[...historico].reverse().map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 text-sm font-bold text-white/80">{row.periodo}</td>
                    <td className="px-6 py-3.5 text-sm font-bold text-green-400">{fmt(row.receitas)}</td>
                    <td className="px-6 py-3.5 text-sm font-bold text-red-400">{fmt(row.despesas)}</td>
                    <td className={`px-6 py-3.5 text-sm font-black ${row.poupancaLiquida >= 0 ? 'text-[#cbfb46]' : 'text-red-400'}`}>{fmt(row.poupancaLiquida)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.taxaPoupanca >= 0 ? 'bg-[#cbfb46]' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(Math.abs(row.taxaPoupanca), 100)}%` }} />
                        </div>
                        <span className={`text-xs font-black ${row.taxaPoupanca >= 20 ? 'text-[#cbfb46]' : row.taxaPoupanca >= 0 ? 'text-white/60' : 'text-red-400'}`}>
                          {row.taxaPoupanca?.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Relatorio;
