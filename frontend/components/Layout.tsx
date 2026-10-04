// src/components/Layout.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, BarChart2, Bell, ChevronDown, ChevronRight, LayoutDashboard, LogOut, Menu, MessageCircle, Newspaper, Palette, Search, Tag, TrendingDown, TrendingUp, Trophy, User, Wallet, Wifi, WifiOff, X } from 'lucide-react';
import dashboardService from '../services/dashboardService';
import api, { setAccessToken } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import useSocket from '../hooks/useSocket';
import useNotificacoes, { NotificacaoTempoReal } from '../hooks/useNotificacoes';
import NotificacoesDrawer from './NotificacoesDrawer';
import { springBouncy, springSmooth } from './ui/animations/variants';
import { useReducedMotion } from '../hooks/useReducedMotion';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  user: { nome: string } | null;
}

interface HeaderStats {
  saldoTotal: number; receitasMes: number; despesasMes: number; taxaPoupanca: number;
}

interface SearchResult { id: string; label: string; sub: string; page: string; }

// ─── Menu config ──────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',      description: 'Visão geral',          Icon: LayoutDashboard                              },
  { id: 'transactions', label: 'Transações',      description: 'Receitas e despesas',  Icon: ArrowLeftRight                    },
  { id: 'cards',        label: 'Carteira',        description: 'Contas e cartões',     Icon: Wallet                            },
  { id: 'categorias',   label: 'Categorias',      description: 'Tipos de gastos',      Icon: Tag                          },
  { id: 'goals',        label: 'Objetivos',       description: 'Metas financeiras',    Icon: Trophy                            },
  { id: 'news',         label: 'Notícias',        description: 'Atualizações',         Icon: Newspaper                         },
  { id: 'kamba',        label: 'Kamba AI',        description: 'Assistente IA',        Icon: MessageCircle, highlight: true },
];

const AVATAR_PAGES = [
  { id: 'perfil',         label: 'Perfil',         Icon: User       },
  { id: 'relatorio',      label: 'Relatório',      Icon: BarChart2     },
  { id: 'personalizacao', label: 'Personalização', Icon: Palette },
];

const ALL_SEARCHABLE: SearchResult[] = [
  ...MENU_ITEMS.map(m  => ({ id: m.id,  label: m.label, sub: m.description,     page: m.id })),
  ...AVATAR_PAGES.map(p => ({ id: p.id, label: p.label, sub: 'Menu utilizador', page: p.id })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtShort = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v.toFixed(0);
const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const getPageLabel = (id: string) => [...MENU_ITEMS, ...AVATAR_PAGES].find(m => m.id === id)?.label || 'Overview';
const getPageDesc  = (id: string) => MENU_ITEMS.find(m => m.id === id)?.description || '';
const STATS_PAGES = ['dashboard', 'transactions', 'cards'];

// ─── Shared card / section header ─────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>
    <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{title}</h3>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate, user }) => {
  const { prefs, maskValue, formatMoney } = useTheme();
  const reducedMotion = useReducedMotion();

  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);
  const [drawerOpen,         setDrawerOpen]        = useState(false);
  const [avatarDropdownOpen, setAvatarDropdownOpen]= useState(false);
  const [searchOpen,         setSearchOpen]        = useState(false);
  const [searchQuery,        setSearchQuery]       = useState('');
  const [socketOnline,       setSocketOnline]      = useState(false);
  const [headerStats,        setHeaderStats]       = useState<HeaderStats | null>(null);
  const [statsLoading,       setStatsLoading]      = useState(true);

  const avatarRef      = useRef<HTMLDivElement>(null);
  const searchRef      = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { notificacoes, totalNaoLidas, loading: loadingNotif, marcarComoLida, marcarTodasLidas, adicionarTempoReal } = useNotificacoes();
  const handleNotificacaoTempoReal = useCallback((dados: unknown) => adicionarTempoReal(dados as NotificacaoTempoReal), [adicionarTempoReal]);

  useSocket({
    onNotificacao: handleNotificacaoTempoReal, onLembrete: handleNotificacaoTempoReal,
    onAlertaGasto: handleNotificacaoTempoReal, onProgressoObjetivo: handleNotificacaoTempoReal,
    onAtualizacaoSaldo: handleNotificacaoTempoReal, onNotificacaoSistema: handleNotificacaoTempoReal,
    onConectado: () => setSocketOnline(true), onDesconectado: () => setSocketOnline(false),
  });

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await dashboardService.obterResumoDashboard();
      if (data.success) setHeaderStats({
        saldoTotal:   data.saldos?.total        ?? 0,
        receitasMes:  data.esteMes?.receitas     ?? 0,
        despesasMes:  data.esteMes?.despesas     ?? 0,
        taxaPoupanca: data.esteMes?.taxaPoupanca ?? 0,
      });
    } catch { /* supplementary */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (STATS_PAGES.includes(activePage)) fetchStats(); }, [activePage, fetchStats]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setAvatarDropdownOpen(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleLogout = async () => {
    // F-019: revoga a sessão no servidor (limpa o cookie httpOnly e o refresh
    // na BD) — sem isto, o reload seguinte renovaria a sessão pelo cookie
    try { await api.post('/auth/logout'); } catch { /* offline: revoga no próximo login */ }
    setAccessToken(null);
    window.location.reload();
  };
  const handleNavigate = (page: string) => { onNavigate(page); setMobileMenuOpen(false); setAvatarDropdownOpen(false); setSearchOpen(false); setSearchQuery(''); };

  const searchResults = searchQuery.trim().length > 0
    ? ALL_SEARCHABLE.filter(r => r.label.toLowerCase().includes(searchQuery.toLowerCase()) || r.sub.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const initials  = (user?.nome || 'K').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const firstName = user?.nome?.split(' ')[0] || 'Kamba';
  const compact   = prefs.sidebarCompacta;

  // ─── NavContent ─────────────────────────────────────────────────────────────
  const NavContent = ({ forceExpanded = false }: { forceExpanded?: boolean }) => {
    const expanded = forceExpanded || !compact;
    return (
      <>
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0 mb-6"
          style={{ padding: expanded ? '24px 16px 0' : '24px 12px 0', justifyContent: expanded ? 'flex-start' : 'center' }}>
          <motion.div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
            whileHover={reducedMotion ? {} : { scale: 1.1, rotate: 5 }}
          >
            <svg fill="black" viewBox="0 0 48 48" className="w-4 h-4"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </motion.div>
          <AnimatePresence>
            {expanded && (
              <motion.div 
                className="flex items-center gap-2 flex-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={springSmooth}
              >
                <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Kamba<span style={{ color: 'var(--accent)' }}>Pro</span>
                </h1>
                <div className="ml-auto">
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full"
                    animate={{ scale: socketOnline ? [1, 1.3, 1] : 1 }}
                    transition={{ duration: 2, repeat: socketOnline ? Infinity : 0 }}
                    style={{ backgroundColor: socketOnline ? '#10b981' : '#52525b' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section label */}
        <AnimatePresence>
          {expanded && (
            <motion.p 
              className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
              style={{ color: 'var(--text-faint)', opacity: 0.5 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
            >
              Menu
            </motion.p>
          )}
        </AnimatePresence>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto space-y-0.5" style={{ padding: expanded ? '0 8px' : '0 6px' }}>
          {MENU_ITEMS.map(({ id, label, description, Icon, highlight }, index) => {
            const active = activePage === id;
            return (
              <motion.button
                key={id}
                onClick={() => handleNavigate(id)}
                title={compact ? label : undefined}
                className="w-full flex items-center rounded-xl"
                style={{
                  gap: expanded ? 12 : 0,
                  padding: expanded ? '9px 12px' : '10px',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  backgroundColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-text)' : highlight ? 'var(--accent)' : 'var(--text-muted)',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springSmooth, delay: index * 0.05 }}
                whileHover={reducedMotion || active ? {} : { backgroundColor: 'var(--bg-elevated)' }}
                whileTap={reducedMotion ? {} : { scale: 0.98 }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {expanded && (
                    <motion.div 
                      className="text-left flex-1 min-w-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="font-semibold block text-sm truncate">{label}</span>
                      <span className="text-[11px] truncate block" style={{
                        color: active ? 'var(--accent-text)' : 'var(--text-faint)', opacity: 0.7
                      }}>{description}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {highlight && !active && (
                  <motion.span 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: 'var(--accent)' }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Divider + section label */}
        {expanded && (
          <p className="text-[10px] font-bold uppercase tracking-widest px-4 mt-5 mb-2"
            style={{ color: 'var(--text-faint)', opacity: 0.5, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            Conta
          </p>
        )}
        {!expanded && <div className="my-3 mx-2 h-px" style={{ backgroundColor: 'var(--border)' }} />}

        {/* Logout footer */}
        <div style={{ padding: expanded ? '0 8px 24px' : '0 6px 24px' }}>
          <button
            onClick={handleLogout}
            title={compact ? 'Sair' : undefined}
            className="w-full flex items-center rounded-xl transition-all"
            style={{
              gap: expanded ? 12 : 0, padding: expanded ? '9px 12px' : '10px',
              justifyContent: expanded ? 'flex-start' : 'center',
              color: 'var(--text-faint)',
            }}
            onMouseEnter={e => { (e.currentTarget).style.color = '#f87171'; (e.currentTarget).style.backgroundColor = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; (e.currentTarget).style.backgroundColor = 'transparent'; }}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {expanded && <span className="text-sm font-medium">Sair da conta</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* Desktop sidebar */}
      <motion.aside
        className="hidden md:flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-base)', borderRight: '1px solid var(--border)',
        }}
        animate={{ width: compact ? 60 : 240, minWidth: compact ? 60 : 240 }}
        transition={springSmooth}
      >
        <NavContent />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 h-full w-64 shadow-2xl flex flex-col"
              style={{ backgroundColor: 'var(--bg-base)', borderRight: '1px solid var(--border)' }}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={springSmooth}
            >
              <div className="flex justify-end p-3">
                <motion.button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--text-faint)' }}
                  whileHover={reducedMotion ? {} : { scale: 1.1, backgroundColor: 'var(--bg-elevated)' }}
                  whileTap={reducedMotion ? {} : { scale: 0.9 }}
                  aria-label="Fechar menu"
                >
                  <X size={20} />
                </motion.button>
              </div>
              <NavContent forceExpanded />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex-shrink-0 sticky top-0 z-20 backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--bg-base) 90%, transparent)', borderBottom: '1px solid var(--border)' }}>

          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 md:px-5 h-14">

            {/* Mobile hamburger */}
            <motion.button 
              onClick={() => setMobileMenuOpen(true)} 
              className="md:hidden p-1.5 rounded-lg flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
              whileHover={reducedMotion ? {} : { scale: 1.1 }}
              whileTap={reducedMotion ? {} : { scale: 0.9 }}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </motion.button>

            {/* Page breadcrumb + title */}
            <div className="flex-1 min-w-0 hidden md:flex items-center gap-1.5">
              <span className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>{getGreeting()}, <strong style={{ color: 'var(--text-muted)' }}>{firstName}</strong></span>
              <ChevronRight size={12} style={{ color: 'var(--border-strong)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{getPageLabel(activePage)}</span>
            </div>

            {/* Mobile title */}
            <h2 className="md:hidden text-base font-bold tracking-tight flex-1" style={{ color: 'var(--text-primary)' }}>
              {getPageLabel(activePage)}
            </h2>

            {/* Search */}
            <motion.div 
              className="relative hidden lg:block" 
              ref={searchRef}
              animate={{ width: searchOpen ? 240 : 150 }}
              transition={springSmooth}
            >
              <motion.div
                className="flex items-center gap-2 h-8 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)', borderColor: searchOpen ? 'var(--accent)' : 'var(--border)',
                  boxShadow: searchOpen ? '0 0 0 3px var(--accent-10)' : 'none',
                }}
                onClick={() => { if (!searchOpen) { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); } }}
                whileHover={reducedMotion || searchOpen ? {} : { scale: 1.02 }}
              >
                <Search size={14} className="ml-3 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                {searchOpen
                  ? <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-primary)' }} />
                  : <span className="flex-1 text-sm select-none" style={{ color: 'var(--text-faint)' }}>Pesquisar</span>
                }
                <kbd className="text-[9px] font-mono mr-2 flex-shrink-0 hidden xl:block px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-faint)', backgroundColor: 'var(--bg-elevated)' }}>⌘K</kbd>
              </motion.div>

              <AnimatePresence>
                {searchOpen && searchQuery.trim().length > 0 && (
                  <motion.div
                    className="absolute top-[calc(100%+6px)] left-0 w-64 rounded-2xl shadow-2xl overflow-hidden z-50 border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={springBouncy}
                  >
                    {searchResults.length > 0 ? (
                      <div className="p-1.5">
                        {searchResults.map((r, index) => {
                          const found = [...MENU_ITEMS, ...AVATAR_PAGES].find(m => m.id === r.id);
                          const Icon = found?.Icon;
                          return (
                            <motion.button 
                              key={r.id} 
                              onClick={() => handleNavigate(r.page)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ ...springSmooth, delay: index * 0.05 }}
                              whileHover={reducedMotion ? {} : { backgroundColor: 'var(--bg-elevated)' }}
                              whileTap={reducedMotion ? {} : { scale: 0.98 }}
                            >
                              {Icon && <Icon size={16} style={{ color: 'var(--text-faint)' }} />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{r.sub}</p>
                              </div>
                              <ChevronRight size={12} className="flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                            </motion.button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Search size={24} style={{ color: 'var(--text-faint)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem resultados</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Socket pill */}
            <motion.div 
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold flex-shrink-0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                backgroundColor: socketOnline ? 'rgba(16,185,129,0.08)' : 'var(--bg-surface)',
                borderColor: socketOnline ? 'rgba(16,185,129,0.2)' : 'var(--border)',
                color: socketOnline ? '#10b981' : 'var(--text-faint)',
              }}
            >
              {socketOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span className="hidden xl:inline">{socketOnline ? 'Ao vivo' : 'Offline'}</span>
            </motion.div>

            {/* Bell */}
            <motion.button
              onClick={() => setDrawerOpen(true)}
              className="relative w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              whileHover={reducedMotion ? {} : { scale: 1.1, borderColor: 'var(--border-strong)' }}
              whileTap={reducedMotion ? {} : { scale: 0.95 }}
              aria-label={`Notificações${totalNaoLidas > 0 ? ` (${totalNaoLidas} não lidas)` : ''}`}
            >
              <Bell size={17} />
              <AnimatePresence>
                {totalNaoLidas > 0 && (
                  <motion.span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 text-[9px] font-black rounded-full flex items-center justify-center px-1"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={springBouncy}
                  >
                    {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Avatar */}
            <div className="relative flex-shrink-0" ref={avatarRef}>
              <motion.button 
                onClick={() => setAvatarDropdownOpen(p => !p)} 
                className="flex items-center gap-1.5"
                whileHover={reducedMotion ? {} : { scale: 1.05 }}
                whileTap={reducedMotion ? {} : { scale: 0.95 }}
              >
                <motion.div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                  animate={{ 
                    borderColor: avatarDropdownOpen ? 'var(--accent)' : 'transparent',
                    scale: avatarDropdownOpen ? 1.05 : 1
                  }}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                    color: 'var(--accent-text)',
                    border: '2px solid',
                  }}
                >
                  {initials}
                </motion.div>
                <motion.div
                  animate={{ rotate: avatarDropdownOpen ? 180 : 0 }}
                  transition={springSmooth}
                >
                  <ChevronDown size={13} className="hidden md:block" style={{ color: 'var(--text-faint)' }} />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {avatarDropdownOpen && (
                  <motion.div
                    className="absolute right-0 top-[calc(100%+8px)] rounded-2xl shadow-2xl overflow-hidden z-50 border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)', minWidth: 200 }}
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={springBouncy}
                  >
                    <motion.div 
                      className="px-4 py-3 flex items-center gap-3"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'var(--accent-text)' }}
                      >
                        {initials}
                      </motion.div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{user?.nome || 'Utilizador'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <motion.div 
                            className="w-1.5 h-1.5 rounded-full" 
                            animate={{ backgroundColor: socketOnline ? '#10b981' : 'var(--text-faint)' }}
                          />
                          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{socketOnline ? 'Online' : 'Offline'}</p>
                        </div>
                      </div>
                    </motion.div>

                    <div className="p-1.5">
                      {AVATAR_PAGES.map(({ id, label, Icon }) => {
                      const active = activePage === id;
                      return (
                        <button key={id} onClick={() => handleNavigate(id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                          style={{ backgroundColor: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-text)' : 'var(--text-muted)' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                          <Icon size={16} className="flex-shrink-0" />
                          {label}
                          {active && <ChevronRight size={13} className="ml-auto" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => { handleLogout(); setAvatarDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ color: '#f87171' }}
                      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'rgba(239,68,68,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                      <LogOut size={16} className="flex-shrink-0" />
                      Sair da conta
                    </button>
                  </div>
                </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Stats bar */}
          {STATS_PAGES.includes(activePage) && (
            <div className="px-4 md:px-5 pb-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {statsLoading ? (
                <div className="flex items-center gap-2 pt-3">
                  <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>A carregar dados…</span>
                </div>
              ) : headerStats ? (
                <div className="flex items-center gap-2 pt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

                  {/* Saldo */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <Wallet size={14} style={{ color: 'var(--accent)' }} />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Saldo</p>
                      <p className="text-sm font-bold leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {maskValue(fmtShort(headerStats.saldoTotal))} <span className="text-[10px] font-normal" style={{ color: 'var(--text-faint)' }}>Kz</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-6 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Entradas */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 border"
                    style={{ backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' }}>
                    <TrendingUp size={14} className="text-emerald-400" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Entradas</p>
                      <p className="text-sm font-bold text-emerald-400 leading-snug mt-0.5">
                        +{maskValue(fmtShort(headerStats.receitasMes))} <span className="text-[10px] font-normal opacity-50">Kz</span>
                      </p>
                    </div>
                  </div>

                  {/* Saídas */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 border"
                    style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}>
                    <TrendingDown size={14} className="text-red-400" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Saídas</p>
                      <p className="text-sm font-bold text-red-400 leading-snug mt-0.5">
                        -{maskValue(fmtShort(headerStats.despesasMes))} <span className="text-[10px] font-normal opacity-50">Kz</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-6 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Poupança */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 border"
                    style={{
                      backgroundColor: headerStats.taxaPoupanca >= 20 ? 'var(--accent-10)' : 'var(--bg-surface)',
                      borderColor: headerStats.taxaPoupanca >= 20 ? 'var(--accent-20)' : 'var(--border)',
                    }}>
                    <div className="relative w-5 h-5 flex-shrink-0">
                      <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="7" fill="none" stroke="var(--border-strong)" strokeWidth="2.5" />
                        <circle cx="10" cy="10" r="7" fill="none"
                          stroke={headerStats.taxaPoupanca >= 20 ? 'var(--accent)' : '#3b82f6'}
                          strokeWidth="2.5"
                          strokeDasharray={`${Math.min(Math.max(headerStats.taxaPoupanca, 0), 100) / 100 * 43.98} 43.98`}
                          strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Poupança</p>
                      <p className="text-sm font-bold leading-snug mt-0.5"
                        style={{ color: headerStats.taxaPoupanca >= 20 ? 'var(--accent)' : '#60a5fa' }}>
                        {maskValue(`${headerStats.taxaPoupanca.toFixed(0)}%`)}
                      </p>
                    </div>
                  </div>

                  <p className="ml-auto text-[11px] font-medium flex-shrink-0 hidden xl:block capitalize" style={{ color: 'var(--text-faint)' }}>
                    {new Date().toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </header>

        {/* Page content */}
        <div className={`flex-1 ${activePage === 'kamba' ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-6'}`}
          style={{ backgroundColor: 'var(--bg-base)' }}>
          {children}
        </div>
      </main>

      <NotificacoesDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        notificacoes={notificacoes} totalNaoLidas={totalNaoLidas}
        loading={loadingNotif} onMarcarLida={marcarComoLida} onMarcarTodasLidas={marcarTodasLidas}
      />

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0);     }
        }
      `}</style>
    </div>
  );
};

export default Layout;
