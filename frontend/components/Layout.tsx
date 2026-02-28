// src/components/Layout.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  UserCircle, BarChart2, Sliders, LogOut,
  Bell, Search, X, Menu, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Wallet,
  Wifi, WifiOff, LayoutDashboard, ArrowRightLeft,
  CreditCard, Tag, Target, Newspaper, MessageCircle,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import useSocket from '../hooks/useSocket';
import useNotificacoes, { NotificacaoTempoReal } from '../hooks/useNotificacoes';
import NotificacoesDrawer from './NotificacoesDrawer';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  user: { nome: string } | null;
}

interface HeaderStats {
  saldoTotal: number;
  receitasMes: number;
  despesasMes: number;
  taxaPoupanca: number;
}

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  page: string;
}

// ─────────────────────────────────────────
// Menu config
// ─────────────────────────────────────────
const MENU_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',       description: 'Visão geral das finanças',  Icon: LayoutDashboard              },
  { id: 'transactions', label: 'Transações',       description: 'Receitas e despesas',       Icon: ArrowRightLeft                },
  { id: 'cards',        label: 'Carteira',         description: 'Contas e cartões',          Icon: CreditCard                    },
  { id: 'categorias',   label: 'Categorias',       description: 'Gerir tipos de gastos',     Icon: Tag                           },
  { id: 'goals',        label: 'Objetivos',        description: 'Metas financeiras',         Icon: Target                        },
  { id: 'news',         label: 'Notícias',         description: 'Atualizações financeiras',  Icon: Newspaper                     },
  { id: 'kamba',        label: 'Falar com Kamba',  description: 'Assistente IA',             Icon: MessageCircle, highlight: true },
];

const AVATAR_PAGES = [
  { id: 'perfil',          label: 'Perfil',          Icon: UserCircle },
  { id: 'relatorio',       label: 'Relatório',       Icon: BarChart2  },
  { id: 'personalizacao',  label: 'Personalização',  Icon: Sliders    },
];

const ALL_SEARCHABLE: SearchResult[] = [
  ...MENU_ITEMS.map(m  => ({ id: m.id,  label: m.label,  sub: m.description,      page: m.id })),
  ...AVATAR_PAGES.map(p => ({ id: p.id, label: p.label,  sub: 'Menu utilizador',  page: p.id })),
];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getPageLabel = (id: string) =>
  [...MENU_ITEMS, ...AVATAR_PAGES].find(m => m.id === id)?.label || 'Overview';

const getPageDesc = (id: string) =>
  MENU_ITEMS.find(m => m.id === id)?.description || '';

const STATS_PAGES = ['dashboard', 'transactions', 'cards'];

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate, user }) => {
  const { prefs, maskValue, formatMoney } = useTheme();

  const [mobileMenuOpen,     setMobileMenuOpen]     = useState(false);
  const [drawerOpen,          setDrawerOpen]         = useState(false);
  const [avatarDropdownOpen,  setAvatarDropdownOpen] = useState(false);
  const [searchOpen,          setSearchOpen]         = useState(false);
  const [searchQuery,         setSearchQuery]        = useState('');
  const [socketOnline,        setSocketOnline]       = useState(false);
  const [headerStats,         setHeaderStats]        = useState<HeaderStats | null>(null);
  const [statsLoading,        setStatsLoading]       = useState(true);

  const avatarRef      = useRef<HTMLDivElement>(null);
  const searchRef      = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications
  const {
    notificacoes, totalNaoLidas, loading: loadingNotif,
    marcarComoLida, marcarTodasLidas, adicionarTempoReal,
  } = useNotificacoes();

  const handleNotificacaoTempoReal = useCallback(
    (dados: unknown) => adicionarTempoReal(dados as NotificacaoTempoReal),
    [adicionarTempoReal],
  );

  useSocket({
    onNotificacao:        handleNotificacaoTempoReal,
    onLembrete:           handleNotificacaoTempoReal,
    onAlertaGasto:        handleNotificacaoTempoReal,
    onProgressoObjetivo:  handleNotificacaoTempoReal,
    onAtualizacaoSaldo:   handleNotificacaoTempoReal,
    onNotificacaoSistema: handleNotificacaoTempoReal,
    onConectado:    () => setSocketOnline(true),
    onDesconectado: () => setSocketOnline(false),
  });

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get('/dashboard/resumo');
      if (data.success) {
        setHeaderStats({
          saldoTotal:   data.saldos?.total          ?? 0,
          receitasMes:  data.esteMes?.receitas       ?? 0,
          despesasMes:  data.esteMes?.despesas       ?? 0,
          taxaPoupanca: data.esteMes?.taxaPoupanca   ?? 0,
        });
      }
    } catch { /* supplementary */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (STATS_PAGES.includes(activePage)) fetchStats(); }, [activePage, fetchStats]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (avatarRef.current  && !avatarRef.current.contains(e.target as Node))  setAvatarDropdownOpen(false);
      if (searchRef.current  && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setAvatarDropdownOpen(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    setAvatarDropdownOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const searchResults = searchQuery.trim().length > 0
    ? ALL_SEARCHABLE.filter(r =>
        r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sub.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const initials  = (user?.nome || 'K').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const firstName = user?.nome?.split(' ')[0] || 'Kamba';

  // ─────────────────────────────────────────
  // Compact sidebar: show only icons
  // ─────────────────────────────────────────
  const compact = prefs.sidebarCompacta;

  // ─────────────────────────────────────────
  // NavContent — adapts to compact mode
  // ─────────────────────────────────────────
  const NavContent = ({ forceExpanded = false }: { forceExpanded?: boolean }) => {
    const expanded = forceExpanded || !compact;
    return (
      <>
        {/* Logo */}
        <div
          className="flex items-center gap-3 mb-8 mt-7 flex-shrink-0"
          style={{ padding: expanded ? '0 16px' : '0 12px', justifyContent: expanded ? 'flex-start' : 'center' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent-20)' }}
          >
            <svg fill="currentColor" viewBox="0 0 48 48" className="w-5 h-5" style={{ color: 'var(--accent-text)' }}>
              <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" />
            </svg>
          </div>
          {expanded && (
            <h1 className="text-xl font-black tracking-tighter uppercase" style={{ color: 'var(--text-primary)' }}>
              Kamba<span style={{ color: 'var(--accent)' }}>Pro</span>
            </h1>
          )}
          {expanded && (
            <div
              className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: socketOnline ? '#22c55e' : 'rgba(255,255,255,0.15)' }}
              title={socketOnline ? 'Tempo real ativo' : 'Offline'}
            />
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto space-y-0.5"
          style={{ padding: expanded ? '0 12px' : '0 8px' }}
        >
          {MENU_ITEMS.map(({ id, label, description, Icon, highlight }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                onClick={() => handleNavigate(id)}
                title={compact ? label : undefined}
                className="w-full flex items-center rounded-xl transition-all"
                style={{
                  gap:              expanded ? '14px' : '0',
                  padding:          expanded ? '10px 14px' : '10px',
                  justifyContent:   expanded ? 'flex-start' : 'center',
                  backgroundColor:  active ? 'var(--accent)' : 'transparent',
                  color:            active ? 'var(--accent-text)' : highlight ? 'var(--accent)' : 'var(--text-muted)',
                  boxShadow:        active ? '0 0 12px var(--accent-20)' : 'none',
                  transition:       'all var(--transition-speed, 200ms)',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {expanded && (
                  <>
                    <div className="text-left flex-1 min-w-0">
                      <span className="font-semibold block text-sm truncate">{label}</span>
                      <span
                        className="text-[11px] truncate block"
                        style={{ color: active ? 'var(--accent-text)' : 'var(--text-faint)', opacity: 0.7 }}
                      >
                        {description}
                      </span>
                    </div>
                    {highlight && !active && (
                      <span
                        className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout footer */}
        <div
          className="pt-5 mt-4 flex-shrink-0"
          style={{
            padding:     expanded ? '20px 12px 28px' : '16px 8px 24px',
            borderTop:   '1px solid var(--border)',
          }}
        >
          <button
            onClick={handleLogout}
            title={compact ? 'Sair' : undefined}
            className="w-full flex items-center rounded-xl transition-all"
            style={{
              gap:            expanded ? '14px' : '0',
              padding:        expanded ? '10px 14px' : '10px',
              justifyContent: expanded ? 'flex-start' : 'center',
              color:          'var(--text-faint)',
              transition:     'color var(--transition-speed,200ms)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-semibold text-sm">Sair da Conta</span>}
          </button>
        </div>
      </>
    );
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)', transition: 'background-color var(--transition-speed,200ms)' }}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width:           compact ? '64px' : '256px',
          minWidth:        compact ? '64px' : '256px',
          backgroundColor: 'var(--bg-base)',
          borderRight:     '1px solid var(--border)',
          transition:      'width var(--transition-speed,200ms), min-width var(--transition-speed,200ms)',
        }}
      >
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="absolute left-0 top-0 h-full w-72 shadow-2xl flex flex-col"
            style={{
              backgroundColor: 'var(--bg-base)',
              borderRight: '1px solid var(--border)',
              animation: 'slideInLeft 0.2s ease-out',
            }}
          >
            <div className="flex justify-end p-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavContent forceExpanded />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ══════════════════
            HEADER
        ══════════════════ */}
        <header
          className="flex-shrink-0 sticky top-0 z-20 backdrop-blur-xl"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 md:px-6 h-16">

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl transition-colors flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page title */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium hidden md:block leading-none mb-0.5" style={{ color: 'var(--text-faint)' }}>
                {getGreeting()},{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{firstName}</span>
                {getPageDesc(activePage) && (
                  <>
                    <span className="mx-1.5" style={{ color: 'var(--border-strong)' }}>·</span>
                    {getPageDesc(activePage)}
                  </>
                )}
              </p>
              <h2
                className="text-base md:text-lg font-black tracking-tight truncate leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {getPageLabel(activePage)}
              </h2>
            </div>

            {/* Search */}
            <div className="relative hidden lg:block" ref={searchRef}>
              <div
                className="flex items-center gap-2 h-9 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: searchOpen ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                  borderColor:     searchOpen ? 'var(--accent)' : 'var(--border-strong)',
                  width:           searchOpen ? '256px' : '160px',
                  transition:      'width var(--transition-speed,200ms), border-color var(--transition-speed,200ms)',
                }}
                onClick={() => { if (!searchOpen) { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); } }}
              >
                <Search className="w-3.5 h-3.5 ml-3 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                {searchOpen ? (
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar secção..."
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                ) : (
                  <span className="flex-1 text-sm select-none" style={{ color: 'var(--text-faint)' }}>Pesquisar</span>
                )}
                <kbd
                  className="text-[9px] font-mono mr-2 flex-shrink-0 hidden xl:block px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-faint)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                >⌘K</kbd>
              </div>

              {searchOpen && searchQuery.trim().length > 0 && (
                <div
                  className="absolute top-[calc(100%+8px)] left-0 w-72 rounded-2xl shadow-2xl overflow-hidden z-50"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-strong)',
                    animation: 'fadeScaleIn 0.12s ease-out',
                  }}
                >
                  {searchResults.length > 0 ? (
                    <div className="p-1.5">
                      {searchResults.map(r => {
                        const found = [...MENU_ITEMS, ...AVATAR_PAGES].find(m => m.id === r.id);
                        const Icon = found?.Icon;
                        return (
                          <button
                            key={r.id}
                            onClick={() => handleNavigate(r.page)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group"
                            style={{ transition: 'background-color var(--transition-speed,200ms)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                          >
                            {Icon && (
                              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{r.sub}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-faint)' }} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 gap-2">
                      <Search className="w-6 h-6" style={{ color: 'var(--text-faint)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem resultados para "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Socket pill */}
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold flex-shrink-0"
              style={{
                backgroundColor: socketOnline ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                borderColor:     socketOnline ? 'rgba(34,197,94,0.2)'  : 'var(--border)',
                color:           socketOnline ? '#4ade80'              : 'var(--text-faint)',
                transition:      'all var(--transition-speed,200ms)',
              }}
            >
              {socketOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden xl:inline">{socketOnline ? 'Ao vivo' : 'Offline'}</span>
            </div>

            {/* Bell */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border:          '1px solid var(--border-strong)',
                color:           'var(--text-muted)',
              }}
              aria-label={`${totalNaoLidas} notificações`}
            >
              <Bell className="w-4 h-4" />
              {totalNaoLidas > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[17px] h-[17px] text-[9px] font-black rounded-full flex items-center justify-center px-1"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color:           'var(--accent-text)',
                    boxShadow:       '0 0 8px var(--accent-20)',
                  }}
                >
                  {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                </span>
              )}
            </button>

            {/* Avatar dropdown */}
            <div className="relative flex-shrink-0" ref={avatarRef}>
              <button
                onClick={() => setAvatarDropdownOpen(p => !p)}
                className="flex items-center gap-1.5 group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 overflow-hidden"
                  style={{
                    border:     '2px solid var(--accent)',
                    background: `linear-gradient(135deg, var(--accent), var(--accent-dark))`,
                    color:      'var(--accent-text)',
                    boxShadow:  avatarDropdownOpen ? '0 0 12px var(--accent-30)' : 'none',
                    transition: 'box-shadow var(--transition-speed,200ms)',
                  }}
                >
                  {initials}
                </div>
                <ChevronDown
                  className="w-3.5 h-3.5 hidden md:block transition-transform duration-200"
                  style={{
                    color:     'var(--text-faint)',
                    transform: avatarDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                  }}
                />
              </button>

              {avatarDropdownOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] rounded-2xl shadow-2xl overflow-hidden z-50"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border:          '1px solid var(--border-strong)',
                    minWidth:        '210px',
                    animation:       'fadeScaleIn 0.12s ease-out',
                  }}
                >
                  {/* User card */}
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, var(--accent), var(--accent-dark))`,
                        color:      'var(--accent-text)',
                      }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {user?.nome || 'Utilizador'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: socketOnline ? '#22c55e' : 'var(--text-faint)' }}
                        />
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {socketOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    {AVATAR_PAGES.map(({ id, label, Icon }) => {
                      const active = activePage === id;
                      return (
                        <button
                          key={id}
                          onClick={() => handleNavigate(id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all"
                          style={{
                            backgroundColor: active ? 'var(--accent)' : 'transparent',
                            color:           active ? 'var(--accent-text)' : 'var(--text-muted)',
                            transition:      'all var(--transition-speed,200ms)',
                          }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {label}
                          {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => { handleLogout(); setAvatarDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{ color: '#f87171' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" />
                      Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats bar ── */}
          {STATS_PAGES.includes(activePage) && (
            <div className="px-4 md:px-6 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
              {statsLoading ? (
                <div className="flex items-center gap-2 pt-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-faint)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>A carregar dados financeiros…</span>
                </div>
              ) : headerStats ? (
                <div className="flex items-center gap-1.5 pt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

                  {/* Saldo */}
                  <button
                    onClick={() => handleNavigate('cards')}
                    className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl flex-shrink-0 transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-strong)' }}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--accent-10)', border: '1px solid var(--accent-20)' }}
                    >
                      <Wallet className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Saldo</p>
                      <p className="text-sm font-black leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {maskValue(fmtShort(headerStats.saldoTotal))}
                        <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-faint)' }}>Kz</span>
                      </p>
                    </div>
                  </button>

                  <div className="w-px h-7 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Receitas */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl flex-shrink-0" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-green-400" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Entradas</p>
                      <p className="text-sm font-black text-green-400 leading-snug mt-0.5">
                        {maskValue(`+${fmtShort(headerStats.receitasMes)}`)}
                        <span className="text-[10px] font-normal ml-0.5 opacity-50">Kz</span>
                      </p>
                    </div>
                  </div>

                  {/* Despesas */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl flex-shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                    <TrendingDown className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Saídas</p>
                      <p className="text-sm font-black text-red-400 leading-snug mt-0.5">
                        {maskValue(`-${fmtShort(headerStats.despesasMes)}`)}
                        <span className="text-[10px] font-normal ml-0.5 opacity-50">Kz</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-7 flex-shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Taxa poupança — mini donut muda com accent */}
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl flex-shrink-0"
                    style={{
                      backgroundColor: headerStats.taxaPoupanca >= 20 ? 'var(--accent-10)' : 'rgba(255,255,255,0.04)',
                      border:          headerStats.taxaPoupanca >= 20 ? '1px solid var(--accent-20)' : '1px solid var(--border-strong)',
                    }}
                  >
                    <div className="relative w-7 h-7 flex-shrink-0">
                      <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                        <circle cx="14" cy="14" r="10" fill="none" stroke="var(--border-strong)" strokeWidth="3" />
                        <circle
                          cx="14" cy="14" r="10" fill="none"
                          stroke={headerStats.taxaPoupanca >= 20 ? 'var(--accent)' : headerStats.taxaPoupanca >= 0 ? '#3b82f6' : '#f43f5e'}
                          strokeWidth="3"
                          strokeDasharray={`${Math.min(Math.max(headerStats.taxaPoupanca, 0), 100) / 100 * 62.8} 62.8`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray var(--transition-speed,200ms), stroke var(--transition-speed,200ms)' }}
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-faint)' }}>Poupança</p>
                      <p
                        className="text-sm font-black leading-snug mt-0.5"
                        style={{ color: headerStats.taxaPoupanca >= 20 ? 'var(--accent)' : headerStats.taxaPoupanca >= 0 ? '#60a5fa' : '#f87171' }}
                      >
                        {maskValue(`${headerStats.taxaPoupanca.toFixed(0)}%`)}
                      </p>
                    </div>
                  </div>

                  {/* Month */}
                  <p className="ml-auto text-xs font-medium flex-shrink-0 hidden xl:block capitalize" style={{ color: 'var(--text-faint)' }}>
                    {new Date().toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </header>

        {/* Page content */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{ backgroundColor: 'var(--bg-base)' }}
        >
          {children}
        </div>
      </main>

      <NotificacoesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notificacoes={notificacoes}
        totalNaoLidas={totalNaoLidas}
        loading={loadingNotif}
        onMarcarLida={marcarComoLida}
        onMarcarTodasLidas={marcarTodasLidas}
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
        .no-animations * { transition: none !important; animation: none !important; }
      `}</style>
    </div>
  );
};

export default Layout;