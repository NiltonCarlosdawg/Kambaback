// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface Preferencias {
  tema: 'escuro' | 'escuro-intenso' | 'midnight';
  accentColor: string;
  sidebarCompacta: boolean;
  mostraValores: boolean;
  animacoes: boolean;
  notifDesktop: boolean;
  notifSom: boolean;
  idioma: 'pt-AO' | 'pt-PT' | 'en';
  formatoData: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
  moedaPadrao: 'AOA' | 'USD' | 'EUR';
  dashboardLayout: 'padrao' | 'compacto' | 'expandido';
}

interface ThemeContextValue {
  prefs: Preferencias;
  /** Apply a partial change immediately (live, not persisted) */
  updatePrefs: (partial: Partial<Preferencias>) => void;
  /** Persist current prefs (or an explicit overwrite) to localStorage */
  savePrefs: (overwrite?: Preferencias) => void;
  /** Reset everything to factory defaults */
  resetPrefs: () => void;
  /** Format a monetary value respecting current moedaPadrao */
  formatMoney: (value: number, short?: boolean) => string;
  /** Format a date respecting current formatoData */
  formatDate: (date: string | Date) => string;
  /** Return value as-is or masked ("••••••") based on mostraValores */
  maskValue: (value: string) => string;
}

// ─────────────────────────────────────────
// Defaults & storage key
// ─────────────────────────────────────────
export const PREFS_DEFAULTS: Preferencias = {
  tema: 'escuro',
  accentColor: '#cbfb46',
  sidebarCompacta: false,
  mostraValores: true,
  animacoes: true,
  notifDesktop: true,
  notifSom: false,
  idioma: 'pt-AO',
  formatoData: 'dd/mm/yyyy',
  moedaPadrao: 'AOA',
  dashboardLayout: 'padrao',
};

export const STORAGE_KEY = 'kamba_preferencias_v2';

// ─────────────────────────────────────────
// Theme → CSS variable maps
// ─────────────────────────────────────────
const TEMA_VARS: Record<Preferencias['tema'], Record<string, string>> = {
  'escuro': {
    '--bg-base':       '#0B0E11',
    '--bg-surface':    '#0F1318',
    '--bg-elevated':   '#161B22',
    '--border':        'rgba(255,255,255,0.07)',
    '--border-strong': 'rgba(255,255,255,0.13)',
    '--text-primary':  '#ffffff',
    '--text-muted':    'rgba(255,255,255,0.45)',
    '--text-faint':    'rgba(255,255,255,0.20)',
  },
  'escuro-intenso': {
    '--bg-base':       '#040507',
    '--bg-surface':    '#08090C',
    '--bg-elevated':   '#0E1016',
    '--border':        'rgba(255,255,255,0.09)',
    '--border-strong': 'rgba(255,255,255,0.16)',
    '--text-primary':  '#ffffff',
    '--text-muted':    'rgba(255,255,255,0.50)',
    '--text-faint':    'rgba(255,255,255,0.22)',
  },
  'midnight': {
    '--bg-base':       '#050A16',
    '--bg-surface':    '#0A1020',
    '--bg-elevated':   '#111828',
    '--border':        'rgba(96,165,250,0.12)',
    '--border-strong': 'rgba(96,165,250,0.22)',
    '--text-primary':  '#ddeeff',
    '--text-muted':    'rgba(160,195,255,0.55)',
    '--text-faint':    'rgba(160,195,255,0.22)',
  },
};

// ─────────────────────────────────────────
// Colour math
// ─────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(r: number, g: number, b: number) {
  const s = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * s(r) + 0.7152 * s(g) + 0.0722 * s(b);
}

export function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return luminance(r, g, b) > 0.35 ? '#000000' : '#ffffff';
}

function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amt)));
  return '#' + [d(r), d(g), d(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function buildAccentVars(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  return {
    '--accent':        hex,
    '--accent-hover':  darken(hex, 0.1),
    '--accent-dark':   darken(hex, 0.25),
    '--accent-rgb':    `${r},${g},${b}`,
    '--accent-text':   contrastColor(hex),
    '--accent-10':     `rgba(${r},${g},${b},0.10)`,
    '--accent-15':     `rgba(${r},${g},${b},0.15)`,
    '--accent-20':     `rgba(${r},${g},${b},0.20)`,
    '--accent-30':     `rgba(${r},${g},${b},0.30)`,
  };
}

// ─────────────────────────────────────────
// Inject all CSS vars into <html>
// This is what makes every component update live
// ─────────────────────────────────────────
function applyTheme(p: Preferencias) {
  const root = document.documentElement;

  // 1. Background / text palette
  const temaVars = TEMA_VARS[p.tema] ?? TEMA_VARS['escuro'];
  Object.entries(temaVars).forEach(([k, v]) => root.style.setProperty(k, v));

  // 2. Accent colour + derived shades
  Object.entries(buildAccentVars(p.accentColor)).forEach(([k, v]) => root.style.setProperty(k, v));

  // 3. Animation speed (consumed by all transition-speed usages)
  root.style.setProperty('--transition-speed', p.animacoes ? '200ms' : '0ms');

  // 4. Sidebar width (consumed by Layout)
  root.style.setProperty('--sidebar-width', p.sidebarCompacta ? '64px' : '256px');

  // 5. Body background so there are no white flashes
  document.body.style.backgroundColor = temaVars['--bg-base'];

  // 6. Data-attributes for CSS-selector overrides (optional, good practice)
  root.setAttribute('data-tema', p.tema);
  root.setAttribute('data-layout', p.dashboardLayout);
  root.setAttribute('data-valores', p.mostraValores ? 'visible' : 'hidden');
  root.classList.toggle('no-animations', !p.animacoes);
  root.classList.add('dark');
}

// ─────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────
const MOEDA_CFG = {
  AOA: { prefix: '',  suffix: ' Kz', locale: 'pt-AO' },
  USD: { prefix: '$', suffix: '',    locale: 'en-US'  },
  EUR: { prefix: '€', suffix: '',    locale: 'pt-PT'  },
} as const;

function formatMoneyFn(value: number, moeda: Preferencias['moedaPadrao'], short = false): string {
  const { prefix, suffix, locale } = MOEDA_CFG[moeda];
  if (short) {
    const a = Math.abs(value), s = value < 0 ? '-' : '';
    if (a >= 1_000_000) return `${s}${prefix}${(a / 1_000_000).toFixed(1)}M${suffix}`;
    if (a >= 1_000)     return `${s}${prefix}${(a / 1_000).toFixed(0)}K${suffix}`;
    return `${s}${prefix}${a.toFixed(0)}${suffix}`;
  }
  return `${prefix}${value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix}`;
}

function formatDateFn(date: string | Date, fmt: Preferencias['formatoData']): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yy = d.getFullYear();
  if (fmt === 'mm/dd/yyyy') return `${mm}/${dd}/${yy}`;
  if (fmt === 'yyyy-mm-dd') return `${yy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yy}`;
}

// ─────────────────────────────────────────
// Context
// ─────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<Preferencias>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...PREFS_DEFAULTS, ...JSON.parse(stored) };
    } catch { /* use defaults */ }
    return PREFS_DEFAULTS;
  });

  // Every state change → re-inject CSS vars instantly
  useEffect(() => { applyTheme(prefs); }, [prefs]);

  const updatePrefs = useCallback((partial: Partial<Preferencias>) => {
    setPrefs(prev => ({ ...prev, ...partial }));
  }, []);

  const savePrefs = useCallback((overwrite?: Preferencias) => {
    const toSave = overwrite ?? prefs;
    if (overwrite) setPrefs(overwrite);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch { /* quota */ }
  }, [prefs]);

  const resetPrefs = useCallback(() => {
    setPrefs(PREFS_DEFAULTS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const formatMoney = useCallback(
    (v: number, short = false) => formatMoneyFn(v, prefs.moedaPadrao, short),
    [prefs.moedaPadrao],
  );

  const formatDate = useCallback(
    (d: string | Date) => formatDateFn(d, prefs.formatoData),
    [prefs.formatoData],
  );

  const maskValue = useCallback(
    (v: string) => prefs.mostraValores ? v : '••••••',
    [prefs.mostraValores],
  );

  return (
    <ThemeContext.Provider value={{ prefs, updatePrefs, savePrefs, resetPrefs, formatMoney, formatDate, maskValue }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export default ThemeContext;
