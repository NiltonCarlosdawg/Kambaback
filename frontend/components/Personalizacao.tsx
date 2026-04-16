// src/components/Personalizacao.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Moon, Monitor, Sun,
  Bell, Eye, EyeOff, Globe, Calendar, DollarSign, Layout,
  RotateCcw, Save, CheckCircle, Sliders, Sparkles, Database,
  Zap, ZapOff, PanelLeft, AlertCircle, LayoutGrid,
} from 'lucide-react';
import { useTheme, PREFS_DEFAULTS, type Preferencias } from '../contexts/ThemeContext';
import { springBouncy, springSmooth, staggerContainer, fadeInUp } from './ui/animations/variants';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const CORES_ACENTO = [
  { hex: '#cbfb46', name: 'Lima'     },
  { hex: '#3b82f6', name: 'Azul'     },
  { hex: '#8b5cf6', name: 'Violeta'  },
  { hex: '#ec4899', name: 'Rosa'     },
  { hex: '#f97316', name: 'Laranja'  },
  { hex: '#06b6d4', name: 'Ciano'    },
  { hex: '#10b981', name: 'Verde'    },
  { hex: '#ef4444', name: 'Vermelho' },
];

const TEMAS: { id: Preferencias['tema']; name: string; desc: string; Icon: React.ElementType; bg: string }[] = [
  { id: 'escuro',          name: 'Escuro',   desc: 'Clássico e confortável', Icon: Moon,    bg: '#0B0E11' },
  { id: 'escuro-intenso',  name: 'Intenso',  desc: 'Alto contraste',         Icon: Monitor, bg: '#040507' },
  { id: 'midnight',        name: 'Midnight', desc: 'Azul profundo',          Icon: Sun,     bg: '#050A16' },
];

// ─────────────────────────────────────────
// Reusable UI primitives (all CSS-var aware)
// ─────────────────────────────────────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  value, onChange, disabled,
}) => (
  <motion.button
    type="button"
    role="switch"
    aria-checked={value}
    disabled={disabled}
    onClick={() => !disabled && onChange(!value)}
    className="relative w-11 h-6 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2"
    style={{
      backgroundColor: value ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      // @ts-ignore
      '--tw-ring-color': 'var(--accent)',
      '--tw-ring-offset-color': 'var(--bg-base)',
    }}
    whileTap={disabled ? {} : { scale: 0.95 }}
  >
    <motion.div
      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md"
      animate={{
        x: value ? 20 : 0,
        backgroundColor: value ? 'var(--accent)' : '#ffffff',
      }}
      transition={springBouncy}
    />
  </motion.button>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    className="rounded-3xl overflow-hidden"
    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={springSmooth}
    whileHover={{ y: -2 }}
  >
    {children}
  </motion.div>
);

const CardHeader: React.FC<{ icon: React.ElementType; title: string; desc: string }> = ({
  icon: Icon, title, desc,
}) => (
  <div
    className="flex items-center gap-3 px-6 py-4"
    style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
  >
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center"
      style={{ background: 'var(--accent-10)', border: '1px solid var(--accent-20)' }}
    >
      <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
    </div>
    <div>
      <h3 className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{desc}</p>
    </div>
  </div>
);

const Row: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({
  label, sub, children,
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const NativeSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}> = ({ value, onChange, options, fullWidth }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className={`rounded-xl px-3 py-2.5 text-sm font-bold outline-none cursor-pointer ${fullWidth ? 'w-full' : ''}`}
    style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid var(--border-strong)',
      color: 'var(--text-primary)',
      transition: 'border-color var(--transition-speed, 200ms)',
    }}
  >
    {options.map(o => (
      <option key={o.value} value={o.value} style={{ background: 'var(--bg-base)' }}>
        {o.label}
      </option>
    ))}
  </select>
);

// ─────────────────────────────────────────
// Live mini-preview of the whole app layout
// ─────────────────────────────────────────
const AppPreview: React.FC<{ prefs: Preferencias }> = ({ prefs }) => {
  const bgMap  = { 'escuro': '#0B0E11', 'escuro-intenso': '#040507', 'midnight': '#050A16' };
  const sfcMap = { 'escuro': '#0F1318', 'escuro-intenso': '#08090C', 'midnight': '#0A1020' };
  const bg  = bgMap[prefs.tema];
  const sfc = sfcMap[prefs.tema];
  const acc = prefs.accentColor;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden shadow-2xl select-none"
      style={{ background: bg, height: 152, border: '1px solid rgba(255,255,255,0.08)' }}
      layoutId="app-preview"
    >
      <div className="flex h-full">
        {/* Sidebar */}
        <div
          className="flex flex-col pt-3 pb-2 px-2 gap-2 flex-shrink-0"
          style={{
            width: prefs.sidebarCompacta ? 28 : 70,
            background: bg,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            transition: 'width 300ms ease',
          }}
        >
          <div className="w-4 h-4 rounded mx-auto flex-shrink-0" style={{ background: acc }} />
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded flex-shrink-0 mx-auto"
              style={{
                height: 5,
                width: prefs.sidebarCompacta ? 12 : '80%',
                background: i === 1 ? acc : 'rgba(255,255,255,0.12)',
                opacity: i === 1 ? 1 : 0.5,
                transition: 'all 300ms ease',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="h-2.5 rounded w-24" style={{ background: 'rgba(255,255,255,0.5)' }} />
            <div className="w-5 h-5 rounded-full" style={{ background: acc }} />
          </div>

          {/* KPI cards */}
          <div className="flex gap-1.5">
            {[acc, '#10b981', '#f43f5e'].map((color, i) => (
              <div
                key={i}
                className="flex-1 rounded-lg p-2"
                style={{ background: sfc, border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="h-1.5 rounded mb-1.5" style={{ background: 'rgba(255,255,255,0.15)', width: '50%' }} />
                <div
                  className="h-2.5 rounded"
                  style={{
                    width: prefs.mostraValores ? '80%' : '35%',
                    background: color,
                    transition: 'width 300ms ease, background 300ms ease',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg p-2" style={{ background: sfc, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-end gap-0.5 h-7">
              {[30, 60, 40, 80, 50, 95, 55, 70, 45, 85].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: i === 5 ? acc : 'rgba(255,255,255,0.12)',
                    transition: 'background 300ms ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        </div>
      </motion.div>
    );
};

// ─────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────
const Personalizacao: React.FC = () => {
  const { prefs, updatePrefs, savePrefs, resetPrefs } = useTheme();

  // Local draft — each change is applied live (via updatePrefs)
  // but only written to localStorage when the user clicks "Guardar"
  const [draft, setDraft]           = useState<Preferencias>(prefs);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);

  // Keep draft in sync if prefs change externally (e.g. resetPrefs)
  useEffect(() => { setDraft(prefs); }, [prefs]);

  useEffect(() => {
    setHasChanges(JSON.stringify(draft) !== JSON.stringify(prefs));
  }, [draft, prefs]);

  /** Update one field, apply live across the whole app */
  const set = <K extends keyof Preferencias>(key: K, value: Preferencias[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    updatePrefs({ [key]: value }); // ← injects CSS var immediately
  };

  const handleSave = () => {
    savePrefs(draft);
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    resetPrefs();
    setDraft(PREFS_DEFAULTS);
    setHasChanges(false);
  };

  const handleNotifToggle = async (v: boolean) => {
    setNotifDenied(false);
    if (v && 'Notification' in window && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') { setNotifDenied(true); return; }
    }
    set('notifDesktop', v);
  };

  // Preview strings
  const today = new Date();
  const dd = today.getDate().toString().padStart(2, '0');
  const mm = (today.getMonth() + 1).toString().padStart(2, '0');
  const yy = today.getFullYear();
  const datePreview =
    draft.formatoData === 'mm/dd/yyyy' ? `${mm}/${dd}/${yy}` :
    draft.formatoData === 'yyyy-mm-dd' ? `${yy}-${mm}-${dd}` :
    `${dd}/${mm}/${yy}`;
  const moneyPreview =
    draft.moedaPadrao === 'USD' ? '$250.00' :
    draft.moedaPadrao === 'EUR' ? '€250,00' : '250.000 Kz';

  // ─────────────────────────────────────────
  return (
    <motion.div 
      className="max-w-3xl mx-auto space-y-6 px-4 pb-28" 
      style={{ color: 'var(--text-primary)' }}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >

      {/* ── Page header ── */}
      <motion.div className="flex items-center justify-between" variants={fadeInUp}>
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-10)', border: '1px solid var(--accent-20)' }}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <Sliders className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </motion.div>
            Personalização
          </h2>
          <p className="text-sm mt-1 ml-[52px]" style={{ color: 'var(--text-faint)' }}>
            Alterações aplicadas em tempo real — guarda para persistir
          </p>
        </div>

        <AnimatePresence>
          {hasChanges && (
            <motion.div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'var(--accent-10)', border: '1px solid var(--accent-20)', color: 'var(--accent)' }}
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              transition={springBouncy}
            >
              <motion.span 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ background: 'var(--accent)' }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              Não guardado
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Saved banner ── */}
      <AnimatePresence>
        {saved && (
          <motion.div 
            className="flex items-center gap-3 p-4 rounded-2xl text-sm font-bold border border-green-500/20 bg-green-500/10 text-green-400"
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={springBouncy}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={springBouncy}
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            </motion.div>
            Preferências guardadas e aplicadas com sucesso!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          PREVIEW AO VIVO
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Eye} title="Pré-visualização ao Vivo" desc="Vê o efeito das tuas escolhas em tempo real" />
        <div className="p-6">
          <AppPreview prefs={draft} />
        </div>
      </Card>

      {/* ══════════════════════════════════════
          TEMA
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Palette} title="Tema da Interface" desc="Define o fundo e tonalidade geral da aplicação" />
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            {TEMAS.map(({ id, name, desc, Icon, bg }, index) => {
              const active = draft.tema === id;
              return (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => set('tema', id)}
                  className="relative flex flex-col gap-3 p-4 rounded-2xl text-left"
                  style={{
                    background: bg,
                    border: `2px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: active ? '0 0 20px var(--accent-20)' : 'none',
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springSmooth, delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: active ? 'var(--accent-20)' : 'rgba(255,255,255,0.08)' }}
                    animate={{ 
                      backgroundColor: active ? 'var(--accent-20)' : 'rgba(255,255,255,0.08)',
                      scale: active ? 1.1 : 1
                    }}
                    transition={springBouncy}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }} />
                  </motion.div>
                  <div>
                    <p className="text-xs font-black text-white">{name}</p>
                    <p className="text-[10px] mt-0.5 text-white/30">{desc}</p>
                  </div>
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)' }}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={springBouncy}
                      >
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"
                          style={{ color: 'var(--accent-text)' }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          COR DE DESTAQUE
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Sparkles} title="Cor de Destaque" desc="Botões, badges, ícones activos e indicadores em toda a app" />
        <div className="p-6 space-y-5">
          <motion.div 
            className="flex flex-wrap gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {CORES_ACENTO.map((c, index) => {
              const active = draft.accentColor === c.hex;
              const lightAccent = ['#cbfb46', '#f97316', '#10b981'].includes(c.hex);
              return (
                <motion.button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => set('accentColor', c.hex)}
                  className="relative w-10 h-10 rounded-xl focus:outline-none"
                  style={{
                    backgroundColor: c.hex,
                    boxShadow: active ? `0 0 0 3px var(--bg-base), 0 0 0 5px ${c.hex}` : 'none',
                  }}
                  variants={fadeInUp}
                  custom={index}
                  whileHover={{ scale: 1.15, y: -3 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence>
                    {active && (
                      <motion.svg 
                        className="absolute inset-0 m-auto w-4 h-4" 
                        fill={lightAccent ? '#000' : '#fff'} 
                        viewBox="0 0 20 20"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={springBouncy}
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Colour info strip */}
          <motion.div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSmooth}
          >
            <motion.div
              className="w-8 h-8 rounded-lg flex-shrink-0"
              style={{ backgroundColor: draft.accentColor }}
              animate={{ backgroundColor: draft.accentColor }}
              transition={springSmooth}
            />
            <div className="flex-1 min-w-0">
              <motion.p 
                className="text-sm font-bold" 
                style={{ color: 'var(--text-primary)' }}
                key={draft.accentColor}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springSmooth}
              >
                {CORES_ACENTO.find(c => c.hex === draft.accentColor)?.name ?? 'Personalizada'}
              </motion.p>
              <motion.p 
                className="text-xs font-mono" 
                style={{ color: draft.accentColor }}
                key={`color-${draft.accentColor}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={springSmooth}
              >
                {draft.accentColor}
              </motion.p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {['Botões', 'Badges', 'Activos'].map((lbl, i) => (
                <motion.span
                  key={lbl}
                  className="text-[10px] px-2 py-1 rounded-lg font-bold"
                  style={{ background: `${draft.accentColor}22`, color: draft.accentColor }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...springBouncy, delay: i * 0.05 }}
                >
                  {lbl}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          LAYOUT & EXIBIÇÃO
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Layout} title="Layout & Exibição" desc="Densidade e visibilidade de informação" />
        <div className="p-6 space-y-5">

          <Row label="Mostrar valores monetários" sub="Oculta saldos com ••••••">
            <div className="flex items-center gap-2.5">
              {draft.mostraValores
                ? <Eye className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                : <EyeOff className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
              }
              <Toggle value={draft.mostraValores} onChange={v => set('mostraValores', v)} />
            </div>
          </Row>

          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-4">
              <Row label="Animações e transições" sub="Desativa para performance ou acessibilidade">
                <div className="flex items-center gap-2.5">
                  {draft.animacoes
                    ? <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    : <ZapOff className="w-4 h-4" style={{ color: 'var(--text-faint)' }} />
                  }
                  <Toggle value={draft.animacoes} onChange={v => set('animacoes', v)} />
                </div>
              </Row>
            </div>
          </div>

          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-4">
              <Row label="Barra lateral compacta" sub="Reduz a sidebar a ícones apenas">
                <div className="flex items-center gap-2.5">
                  <PanelLeft className="w-4 h-4" style={{ color: draft.sidebarCompacta ? 'var(--accent)' : 'var(--text-faint)' }} />
                  <Toggle value={draft.sidebarCompacta} onChange={v => set('sidebarCompacta', v)} />
                </div>
              </Row>
            </div>
          </div>

          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-4">
              <Row label="Layout do Dashboard" sub="Densidade de informação na página principal">
                <NativeSelect
                  value={draft.dashboardLayout}
                  onChange={v => set('dashboardLayout', v as Preferencias['dashboardLayout'])}
                  options={[
                    { value: 'padrao',    label: 'Padrão'    },
                    { value: 'compacto',  label: 'Compacto'  },
                    { value: 'expandido', label: 'Expandido' },
                  ]}
                />
              </Row>
            </div>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          NOTIFICAÇÕES
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Bell} title="Notificações" desc="Como recebes alertas do KambaPro" />
        <div className="p-6 space-y-5">
          <Row label="Notificações no browser" sub="Alertas mesmo com o separador em segundo plano">
            <Toggle value={draft.notifDesktop} onChange={handleNotifToggle} />
          </Row>
          {notifDenied && (
            <div className="flex items-center gap-2 text-yellow-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Permissão negada. Activa nas definições do browser.
            </div>
          )}
          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="pt-4">
              <Row label="Som de notificação" sub="Reproduz áudio ao receber alertas">
                <Toggle value={draft.notifSom} onChange={v => set('notifSom', v)} />
              </Row>
            </div>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          REGIÃO & FORMATO
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Globe} title="Região & Formato" desc="Idioma, datas e moeda apresentadas na app" />
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
                <Globe className="w-3 h-3" /> Idioma
              </label>
              <NativeSelect
                value={draft.idioma}
                onChange={v => set('idioma', v as Preferencias['idioma'])}
                fullWidth
                options={[
                  { value: 'pt-AO', label: '🇦🇴 Português (Angola)'   },
                  { value: 'pt-PT', label: '🇵🇹 Português (Portugal)' },
                  { value: 'en',    label: '🇬🇧 English'               },
                ]}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
                <Calendar className="w-3 h-3" /> Formato de Data
              </label>
              <NativeSelect
                value={draft.formatoData}
                onChange={v => set('formatoData', v as Preferencias['formatoData'])}
                fullWidth
                options={[
                  { value: 'dd/mm/yyyy', label: 'DD/MM/AAAA' },
                  { value: 'mm/dd/yyyy', label: 'MM/DD/AAAA' },
                  { value: 'yyyy-mm-dd', label: 'AAAA-MM-DD' },
                ]}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
                <DollarSign className="w-3 h-3" /> Moeda Padrão
              </label>
              <NativeSelect
                value={draft.moedaPadrao}
                onChange={v => set('moedaPadrao', v as Preferencias['moedaPadrao'])}
                fullWidth
                options={[
                  { value: 'AOA', label: 'AOA — Kwanza' },
                  { value: 'USD', label: 'USD — Dollar' },
                  { value: 'EUR', label: 'EUR — Euro'   },
                ]}
              />
            </div>
          </div>

          {/* Format preview */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
          >
            <LayoutGrid className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
            <div className="flex gap-6 text-sm flex-wrap">
              <div>
                <span style={{ color: 'var(--text-faint)' }}>Data: </span>
                <span className="font-bold" style={{ color: 'var(--accent)' }}>{datePreview}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-faint)' }}>Valor: </span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {draft.mostraValores ? moneyPreview : '••••••'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          DADOS & PRIVACIDADE
      ══════════════════════════════════════ */}
      <Card>
        <CardHeader icon={Database} title="Dados & Privacidade" desc="Gestão das preferências locais" />
        <div className="p-6 space-y-5">
          <div
            className="flex items-start gap-3 p-4 rounded-xl text-xs"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--text-faint)', lineHeight: 1.6 }}
          >
            <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
            As tuas preferências são guardadas localmente no dispositivo e nunca enviadas para os servidores.
          </div>
          <Row label="Limpar dados locais" sub="Remove todas as preferências e repõe os valores padrão">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}
            >
              <RotateCcw className="w-3 h-3" /> Limpar
            </button>
          </Row>
        </div>
      </Card>

      {/* ══════════════════════════════════════
          FIXED ACTION BAR
      ══════════════════════════════════════ */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-30 md:left-64"
        style={{
          background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
        }}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={springSmooth}
      >
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">

          <motion.button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}
            whileHover={{ scale: 1.05, borderColor: 'var(--border-strong)' }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              animate={{ rotate: hasChanges ? [0, -360] : 0 }}
              transition={{ duration: 0.5 }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </motion.span>
            <span className="hidden sm:inline">Repor Padrões</span>
          </motion.button>

          <div className="flex items-center gap-3">
            <AnimatePresence>
              {hasChanges && (
                <motion.p 
                  className="text-xs hidden sm:block" 
                  style={{ color: 'var(--text-faint)' }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={springSmooth}
                >
                  Não guardado
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm"
              style={{
                backgroundColor: hasChanges ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                color:           hasChanges ? 'var(--accent-text)' : 'rgba(255,255,255,0.20)',
                cursor:          hasChanges ? 'pointer' : 'not-allowed',
                boxShadow:       hasChanges ? '0 0 20px var(--accent-20)' : 'none',
              }}
              whileHover={hasChanges ? { scale: 1.05, y: -2 } : {}}
              whileTap={hasChanges ? { scale: 0.95 } : {}}
              animate={{
                boxShadow: hasChanges ? [0, '0 0 20px var(--accent-20)', '0 0 30px var(--accent-30)', '0 0 20px var(--accent-20)'] : 'none',
              }}
              transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
            >
              {saved ? <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springBouncy}
              ><CheckCircle className="w-4 h-4" /></motion.span> : <Save className="w-4 h-4" />}
              <motion.span
                key={saved ? 'saved' : 'save'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springSmooth}
              >
                {saved ? 'Guardado!' : 'Guardar'}
              </motion.span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Personalizacao;