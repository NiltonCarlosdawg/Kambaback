// src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle, Info, LayoutDashboard, Lock, Plus, RefreshCw, TrendingDown, TrendingUp, Trophy, Wallet } from 'lucide-react';
import dashboardService, { DashboardData, HistoricoData } from '../services/dashboardService';
import goalsService from '../services/goalsService';
import transactionsService from '../services/transactionsService';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';
import { RuixenStatsChart } from './ui/ruixen-stats';
import { SkeletonCard, SkeletonChart, SkeletonRow } from './ui/Skeleton';
import { Objetivo, Gasto } from '../types';

// ─── Modern Card Components (Based on 21st.dev patterns) ───────────────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`rounded-xl border shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', ...style }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
    <div>
      {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>{subtitle}</p>}
      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    {right}
  </div>
);

// ─── KPI Card Component ───────────────────────────────────────────────────────────────────
const KPICard: React.FC<{ 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: React.ReactNode; 
  trend?: { value: number; positive: boolean }; 
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  index?: number;
}> = ({ title, value, subtitle, icon, trend, variant = 'primary', index = 0 }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary': return { 
        bg: 'var(--accent)', 
        text: 'var(--accent)', 
        light: 'var(--accent-10)', 
        border: 'var(--accent-20)',
        gradient: `linear-gradient(135deg, var(--accent) 0%, var(--accent-70) 100%)`
      };
      case 'secondary': return { 
        bg: 'var(--text-faint)', 
        text: 'var(--text-secondary)', 
        light: 'var(--bg-elevated)', 
        border: 'var(--border)',
        gradient: `linear-gradient(135deg, #6b7280 0%, #4b5563 100%)`
      };
      case 'success': return { 
        bg: '#10b981', 
        text: '#10b981', 
        light: 'rgba(16,185,129,0.1)', 
        border: 'rgba(16,185,129,0.2)',
        gradient: `linear-gradient(135deg, #10b981 0%, #059669 100%)`
      };
      case 'warning': return { 
        bg: '#f59e0b', 
        text: '#f59e0b', 
        light: 'rgba(245,158,11,0.1)', 
        border: 'rgba(245,158,11,0.2)',
        gradient: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`
      };
      case 'danger': return { 
        bg: '#ef4444', 
        text: '#ef4444', 
        light: 'rgba(239,68,68,0.1)', 
        border: 'rgba(239,68,68,0.2)',
        gradient: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`
      };
      default: return { 
        bg: 'var(--accent)', 
        text: 'var(--accent)', 
        light: 'var(--accent-10)', 
        border: 'var(--accent-20)',
        gradient: `linear-gradient(135deg, var(--accent) 0%, var(--accent-70) 100%)`
      };
    }
  };

  const styles = getVariantStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springBouncy, delay: index * 0.1 }}
      whileHover={{ y: -4, scale: 1.02, transition: springBouncy }}
    >
      <Card className="p-5" style={{ 
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid var(--border)`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
              style={{ 
                background: styles.gradient,
                boxShadow: `0 4px 12px ${styles.bg}30`
              }}
              whileHover={{ rotate: 15, scale: 1.1 }}
            >
              {React.cloneElement(icon as React.ReactElement, { 
                size: 22, 
                style: { color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' } 
              })}
            </motion.div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" 
                style={{ color: 'var(--text-faint)', opacity: 0.8 }}>{title}</p>
              <p className="text-2xl font-bold tracking-tight" 
                style={{ color: 'var(--text-primary)' }}>{value}</p>
              {subtitle && <p className="text-xs mt-0.5" 
                style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
            </div>
          </div>
          {trend && (
            <motion.div 
              className="px-3 py-1.5 rounded-full flex items-center gap-1"
              style={{ 
                backgroundColor: styles.light, 
                border: `1px solid ${styles.border}`
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: index * 0.1 + 0.2 }}
            >
              <span className="text-sm font-bold" style={{ color: styles.text }}>
                {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
              </span>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

// ─── Activity Item Component ───────────────────────────────────────────────────────────────────
const ActivityItem: React.FC<{ 
  title: string; 
  description: string; 
  amount: number; 
  icon: React.ReactNode; 
  time: string;
  index?: number;
}> = ({ title, description, amount, icon, time, index = 0 }) => {
  const isPositive = amount > 0;

  return (
    <motion.div 
      className="flex items-center justify-between py-3.5 px-4 rounded-lg"
      style={{ 
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'transparent'
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springSmooth, delay: index * 0.05 }}
      whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="flex items-center gap-3">
        <motion.div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ 
            backgroundColor: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: isPositive ? '#10b981' : '#f87171'
          }}
          whileHover={{ scale: 1.1 }}
        >
          {icon}
        </motion.div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold text-sm" 
          style={{ color: isPositive ? '#10b981' : '#f87171' }}>
          {isPositive ? '+' : ''}{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'AOA' })}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{time}</p>
      </div>
    </motion.div>
  );
};

// ─── Progress Bar Component ───────────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ 
  progress: number; 
  label: string; 
  value: string; 
  total: string; 
  color?: string;
  index?: number; 
}> = ({ progress, label, value, total, color = 'var(--accent)', index = 0 }) => (
  <motion.div 
    className="space-y-2"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...springSmooth, delay: index * 0.1 + 0.2 }}
  >
    <div className="flex justify-between items-center">
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
        {value} de {total}
      </span>
    </div>
    <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <motion.div 
        className="h-2.5 rounded-full relative" 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ 
          ...springSmooth,
          delay: index * 0.1 + 0.3,
          type: 'spring',
          stiffness: 100,
          damping: 20,
        }}
        style={{ 
          background: `linear-gradient(90deg, ${color} 0%, ${color}80 100%)`,
          boxShadow: `0 0 10px ${color}40`
        }}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </motion.div>
    </div>
    <div className="flex justify-between items-center">
      <motion.span 
        className="text-xs font-semibold" 
        style={{ color: 'var(--accent)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.1 + 0.5 }}
      >
        {progress.toFixed(0)}% concluído
      </motion.span>
      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
        {progress >= 100 ? '✅ Meta atingida' : `Falta ${Math.max(0, 100 - progress).toFixed(0)}%`}
      </span>
    </div>
  </motion.div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { formatMoney, maskValue, formatDate, prefs } = useTheme();

  const [data,               setData]               = useState<DashboardData | null>(null);
  const [historico,          setHistorico]          = useState<HistoricoData | null>(null);
  const [objetivos,          setObjetivos]          = useState<Objetivo[]>([]);
  const [ultimasTransacoes,  setUltimasTransacoes]  = useState<Gasto[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [refreshing,         setRefreshing]          = useState(false);
  const [error,              setError]              = useState('');
  const [valoresCalculados,  setValoresCalculados]  = useState({ patrimonioTotal: 0, saldoDisponivel: 0, saldoReservado: 0, emObjetivos: 0, emCartoes: 0 });
  const [chartPeriodo,      setChartPeriodo]        = useState<'31dias' | 'trimestre' | 'semestre'>('semestre');

  const fetchData = async (showLoading = true, periodo = chartPeriodo) => {
    if (showLoading) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [dashRes, objRes, transRes, histRes] = await Promise.all([
        dashboardService.obterResumo().catch(() => null),
        goalsService.listar().catch(() => null),
        transactionsService.listar(5).catch(() => null),
        dashboardService.obterHistorico(periodo).catch(() => null),
      ]);
      
      const objetivosData = objRes?.objetivos || [];
      setObjetivos(objetivosData.slice(0, 3));
      setUltimasTransacoes((transRes?.gastos || transRes?.transacoes || []).slice(0, 5));
      
      if (histRes?.success) {
        setHistorico(histRes);
      }
      
      const dadosDashboard = dashRes?.success ? dashRes : null;
      if (!dadosDashboard) { setError('Falha ao carregar insights.'); return; }
      
      setData(dadosDashboard); 
      calcularValores(dadosDashboard, objetivosData);
    } catch { setError('Falha ao carregar dados.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const calcularValores = (dashData: DashboardData, objs: Objetivo[]) => {
    const emCartoes = dashData.saldos?.total || 0;
    const emObjetivos = objs.reduce((a, o) => a + Number(o.valorAtual || 0), 0);
    setValoresCalculados({ patrimonioTotal: emCartoes + emObjetivos, saldoDisponivel: dashData.saldos?.disponivel || 0, saldoReservado: dashData.saldos?.reservado || 0, emObjetivos, emCartoes });
  };

  useEffect(() => {
    fetchData(loading, chartPeriodo);
  }, [chartPeriodo]);

  useEffect(() => {
    const i = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData(false, chartPeriodo);
    }, 30000);

    return () => clearInterval(i);
  }, [chartPeriodo]);

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
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart />
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );

  if (error && !data) return (
    <motion.div 
      className="flex h-full flex-col items-center justify-center gap-4 p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <AlertCircle size={40} style={{ color: '#f87171' }} />
      <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>{error}</p>
      <motion.button 
        onClick={() => fetchData()}
        className="px-5 py-2.5 rounded-xl font-medium text-sm"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Tentar Novamente
      </motion.button>
    </motion.div>
  );

  if (!data) return null;

  const { patrimonioTotal, saldoDisponivel, saldoReservado, emObjetivos, emCartoes } = valoresCalculados;
  const taxaPoupanca = data.esteMes.taxaPoupanca ?? (data.esteMes.receitas > 0 ? (data.esteMes.poupancaLiquida / data.esteMes.receitas) * 100 : 0);
  
  // Use historical data for chart if available, otherwise fall back to current month
  // Each point represents the value for that specific month
  const historicoFiltrado = historico?.historico && historico.historico.length > 0
    ? historico.historico
    : null;

  const chartData = historicoFiltrado
    ? (() => {
        const magnitudeBase = Math.max(...historicoFiltrado.map(h =>
          Math.max(Math.abs(Number(h.receitas || 0)), Math.abs(Number(h.despesas || 0)), 1)
        ), 100);

        let nivelAtual = 8;
        const serie: { name: string; value: number }[] = [{ name: 'Início', value: nivelAtual }];

        historicoFiltrado.forEach((h, index) => {
          const receitas = Math.abs(Number(h.receitas || 0));
          const despesas = Math.abs(Number(h.despesas || 0));
          const progresso = (index + 1) / Math.max(historicoFiltrado.length, 1);

          const impulsoReceita = (receitas / magnitudeBase) * 28;
          const impactoDespesa = (despesas / magnitudeBase) * 24;
          const tendencia = 6 + progresso * 8;

          nivelAtual += tendencia + impulsoReceita;
          serie.push({ name: `${h.periodo}-receitas`, value: nivelAtual });

          nivelAtual = Math.max(6, nivelAtual - impactoDespesa);
          serie.push({ name: h.periodo, value: nivelAtual });
        });

        const menorValor = Math.min(...serie.map(item => item.value));
        return serie.map(item => ({
          name: item.name,
          value: item.value - menorValor + 8,
        }));
      })()
    : (() => {
        const receitas = Math.abs(data.esteMes.receitas);
        const despesas = Math.abs(data.esteMes.despesas);
        const saldo = data.esteMes.poupancaLiquida;
        const base = 10;
        const ganho = Math.max(receitas / Math.max(receitas + despesas, 1), 0.2);
        const impactoDespesa = Math.max(despesas / Math.max(receitas + despesas, 1), 0.1);

        return [
          { name: 'Início', value: base },
          { name: 'Receitas', value: base + 42 * ganho + 18 },
          { name: 'Despesas', value: base + 30 * ganho - 20 * impactoDespesa + 16 },
          { name: 'Agora', value: base + 52 * ganho + Math.max(saldo, 0) / Math.max(receitas || 1, 1) * 12 + 22 },
        ];
      })();

  const chartResumo = historicoFiltrado
    ? historicoFiltrado.reduce((acc, item) => ({
        receitas: acc.receitas + Math.abs(Number(item.receitas || 0)),
        despesas: acc.despesas + Math.abs(Number(item.despesas || 0)),
        poupanca: acc.poupanca + Number(item.poupancaLiquida || 0),
      }), { receitas: 0, despesas: 0, poupanca: 0 })
    : {
        receitas: Math.abs(data.esteMes.receitas),
        despesas: Math.abs(data.esteMes.despesas),
        poupanca: data.esteMes.poupancaLiquida,
      };

  const taxaPoupancaGrafico = chartResumo.receitas > 0
    ? (chartResumo.poupanca / chartResumo.receitas) * 100
    : 0;

  const chartSideStats = [
    { value: maskValue(formatMoney(chartResumo.receitas)), label: 'Receitas do período' },
    { value: maskValue(formatMoney(chartResumo.despesas)), label: 'Despesas do período' },
    { value: `${Math.abs(taxaPoupancaGrafico).toFixed(1)}%`, label: 'Taxa de poupança' },
    { value: maskValue(formatMoney(Math.abs(chartResumo.poupanca))), label: chartResumo.poupanca >= 0 ? 'Poupança líquida' : 'Défice líquido' },
  ];

  const heroValue = chartResumo.receitas;
  const heroLabel = historicoFiltrado ? `Receitas (${chartPeriodo === '31dias' ? '1M' : chartPeriodo === 'trimestre' ? '3M' : '6M'})` : 'Receitas do período';

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      
      {/* Page header */}
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSmooth}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Visão Geral</p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Resumo do teu patrimônio
            {data.cached && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset"
              style={{ color: 'var(--text-faint)', backgroundColor: 'var(--bg-elevated)', ringColor: 'var(--border)' }}>cache</span>}
          </p>
        </div>
        <motion.button 
          onClick={() => fetchData(false)} 
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50 border"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          whileHover={!refreshing ? { color: 'var(--accent)', borderColor: 'var(--accent-20)' } : {}}
          whileTap={!refreshing ? { scale: 0.98 } : {}}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'A atualizar…' : 'Atualizar'}
        </motion.button>
      </motion.div>

      {/* Alerts */}
      {data.alertas?.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <motion.div 
              key={i} 
              className="flex items-center gap-3 p-3.5 rounded-xl border text-sm" 
              style={getAlertStyle(a.tipo)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springSmooth, delay: i * 0.1 }}
            >
              {getAlertIcon(a.tipo)}
              <div className="flex-1">
                <span className="font-bold">{a.titulo}</span>
                <span className="opacity-80 ml-1.5">{a.mensagem}</span>
              </div>
              {a.valor && <span className="text-xl font-bold opacity-40">{a.valor}%</span>}
            </motion.div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Patrimônio Total"
          value={maskValue(formatMoney(patrimonioTotal))}
          icon={<LayoutDashboard size={24} />}
          variant="primary"
        />
        <KPICard
          title="Disponível"
          value={maskValue(formatMoney(saldoDisponivel))}
          subtitle={`${emCartoes > 0 ? ((saldoDisponivel / emCartoes) * 100).toFixed(0) : 0}% dos cartões`}
          icon={<Wallet size={24} />}
          variant="success"
        />
        <KPICard
          title="Comprometido"
          value={maskValue(formatMoney(saldoReservado + emObjetivos))}
          subtitle="reservado + objetivos"
          icon={<Lock size={24} />}
          variant="warning"
        />
        <KPICard
          title="Taxa de Poupança"
          value={`${Math.abs(taxaPoupanca).toFixed(1)}%`}
          subtitle={taxaPoupanca >= 20 ? 'Excelente' : taxaPoupanca >= 10 ? 'Razoável' : 'Baixa'}
          icon={<Trophy size={24} />}
          variant={taxaPoupanca >= 20 ? 'success' : taxaPoupanca >= 0 ? 'secondary' : 'danger'}
          trend={{ value: taxaPoupanca, positive: taxaPoupanca >= 0 }}
        />
      </div>

      {/* Charts + Objetivos + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          <Card className="p-4">
            <SectionHeader
              title="Fluxo Financeiro"
              subtitle={historico?.historico ? `Últimos ${chartData.length} meses` : 'Este mês'}
              right={
                <div className="flex gap-1">
                  {(['31dias', 'trimestre', 'semestre'] as const).map(p => (
                    <motion.button
                      key={p}
                      onClick={() => setChartPeriodo(p)}
                      className="px-2 py-1 text-[10px] font-medium rounded-lg"
                      style={{
                        backgroundColor: chartPeriodo === p ? 'var(--accent)' : 'transparent',
                        color: chartPeriodo === p ? 'var(--accent-text)' : 'var(--text-faint)',
                        border: `1px solid ${chartPeriodo === p ? 'var(--accent)' : 'var(--border)'}`
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {p === '31dias' ? '1M' : p === 'trimestre' ? '3M' : '6M'}
                    </motion.button>
                  ))}
                </div>
              }
            />
            <div className="pt-4">
              <RuixenStatsChart
                data={chartData}
                heroValue={heroValue}
                heroLabel={heroLabel}
                sideStats={chartSideStats}
                accentColor={prefs.accentColor}
              />
            </div>
          </Card>

          {/* Objetivos */}
          {objetivos.length > 0 && (
            <Card>
              <SectionHeader title="Progresso dos Objetivos" subtitle="Metas activas" />
              <div className="p-4 space-y-4">
                {objetivos.map((obj, index) => {
                  const valorAtual = Number(obj.valorAtual), valorAlvo = Number(obj.valorAlvo);
                  const progresso = Math.min((valorAtual / valorAlvo) * 100, 100);
                  const diasRestantes = getDiasRestantes(obj.dataPrevista);
                  return (
                    <div key={obj.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{obj.titulo}</span>
                          {progresso >= 100 && (
                            <motion.span 
                              className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring' }}
                            >
                              Concluído
                            </motion.span>
                          )}
                          {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 30 && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              {diasRestantes}d
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {maskValue(formatMoney(valorAtual))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            de {maskValue(formatMoney(valorAlvo))}
                          </div>
                        </div>
                      </div>
                      <ProgressBar 
                        progress={progresso}
                        label=""
                        value={maskValue(formatMoney(valorAtual))}
                        total={maskValue(formatMoney(valorAlvo))}
                        color={obj.cor || 'var(--accent)'}
                        index={index}
                      />
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
              <div className="p-6 text-center">
                <ArrowLeftRight size={30} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Sem movimentações</p>
              </div>
            ) : (
              <div>
                {ultimasTransacoes.map((t, index) => {
                  const isReceita = t.tipo === 'RECEITA', valor = Number(t.valor);
                  return (
                    <ActivityItem
                      key={t.id}
                      title={t.descricao || (isReceita ? 'Receita' : 'Despesa')}
                      description={`${t.categoria?.nome || 'Geral'} · ${formatDate(t.data)}`}
                      amount={isReceita ? valor : -valor}
                      icon={isReceita ? <ArrowUp size={20} className="text-green-600" /> : <ArrowDown size={20} className="text-red-600" />}
                      time="Agora"
                      index={index}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
