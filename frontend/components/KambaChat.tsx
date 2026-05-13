// src/components/KambaChat.tsx
// — Visual melhorado inspirado no AnimatedAIChat (fundo escuro, glassmorphism, Framer Motion)
// — Sem lista lateral de conversas (chat full-width)
// — Conversa persistida em sessionStorage (sobrevive a navegação na mesma aba)
// — No mount, tenta carregar histórico do backend via GET /kamba/historico

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoPaperPlaneOutline,
  IoCheckmarkDoneOutline, IoCheckmarkOutline,
  IoMicOutline, IoCloseOutline,
  IoWalletOutline, IoStatsChartOutline, IoFlashOutline,
  IoTrophyOutline, IoSparklesOutline,
  IoBarChartOutline, IoShieldCheckmarkOutline,
  IoWarningOutline, IoCheckmarkCircleOutline,
  IoArrowRedoOutline, IoPersonOutline,
  IoCreateOutline, IoAddOutline,
  IoAttachOutline,
} from 'react-icons/io5';
import api from '../services/api';
import useSocket from '../hooks/useSocket';
import { useReducedMotion } from '../hooks/useReducedMotion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialCard {
  type: 'balance' | 'alert' | 'goal' | 'tip';
  title: string;
  value?: string;
  subtitle?: string;
  progress?: number;
  icon: React.ReactNode;
  color: string;
}

interface FinancialCardSerialized {
  type: 'balance' | 'alert' | 'goal' | 'tip';
  title: string;
  value?: string;
  subtitle?: string;
  progress?: number;
  iconType?: string;
  color: string;
}

interface Message {
  id: string;
  text: string;
  from: 'kamba' | 'user' | 'system';
  time: string;
  read?: boolean;
  fluxoAtivo?: boolean;
  fluxoConcluido?: boolean;
  fromCache?: boolean;
  cardData?: FinancialCardSerialized;
}

interface LembreteTempoReal {
  id?: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dataHora?: string;
}

// ─── Persistência sessionStorage ─────────────────────────────────────────────

const SESSION_MSGS_KEY  = 'kamba_msgs_v2';
const SESSION_FLUXO_KEY = 'kamba_fluxo_v2';
const MAX_STORED_MSGS   = 120;

function loadStoredMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_MSGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveStoredMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(SESSION_MSGS_KEY, JSON.stringify(msgs.slice(-MAX_STORED_MSGS)));
  } catch {}
}

function loadStoredFluxo(): string | undefined {
  try { return sessionStorage.getItem(SESSION_FLUXO_KEY) || undefined; }
  catch { return undefined; }
}

function saveStoredFluxo(fluxo: string | undefined) {
  try {
    if (fluxo) sessionStorage.setItem(SESSION_FLUXO_KEY, fluxo);
    else sessionStorage.removeItem(SESSION_FLUXO_KEY);
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowStr = () =>
  new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });

function cx(...cls: (string | boolean | undefined)[]) {
  return cls.filter(Boolean).join(' ');
}

function rehydrateCardIcon(iconType?: string): React.ReactNode {
  switch (iconType) {
    case 'warning': return <IoWarningOutline size={14} />;
    case 'trophy':  return <IoTrophyOutline  size={14} />;
    case 'wallet':  return <IoWalletOutline  size={14} />;
    default:        return <IoSparklesOutline size={14} />;
  }
}

function cardFromSerialized(cd?: FinancialCardSerialized): FinancialCard | undefined {
  if (!cd) return undefined;
  return { ...cd, icon: rehydrateCardIcon(cd.iconType) };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: <IoWalletOutline      size={13} />, label: 'Saldo',           cmd: 'Qual o meu saldo?' },
  { icon: <IoStatsChartOutline  size={13} />, label: 'Análise do mês',  cmd: 'análise do mês' },
  { icon: <IoTrophyOutline      size={13} />, label: 'Objetivos',       cmd: 'Como vão meus objetivos?' },
  { icon: <IoBarChartOutline    size={13} />, label: 'Gastos',          cmd: 'Gastos por categoria' },
  { icon: <IoFlashOutline       size={13} />, label: 'Criar meta',      cmd: 'criar meta' },
  { icon: <IoShieldCheckmarkOutline size={13} />, label: 'Emergência',  cmd: 'Como está meu fundo de emergência?' },
];

const WELCOME_MSG: Message = {
  id:   'welcome-0',
  text: 'Boas, kamba! 👊 Eu sou o teu assistente financeiro pessoal.\n\nPosso ajudar-te com o teu **saldo**, **gastos**, **objetivos** e muito mais. Digita **"ajuda"** para ver tudo o que posso fazer!',
  from: 'kamba',
  time: nowStr(),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RenderText({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <>
      {text.split('\n').map((line, li) => {
        if (line === '---') return (
          <div key={li} className={cx('my-2 border-t', isUser ? 'border-white/20' : 'border-white/10')} />
        );
        const parts = line.split('**');
        return (
          <p key={li} className={li > 0 ? 'mt-1' : ''}>
            {parts.map((part, i) =>
              i % 2 === 1
                ? <strong key={i} className="font-semibold text-white">{part}</strong>
                : part
            )}
          </p>
        );
      })}
    </>
  );
}

function FinancialCardInline({ card }: { card: FinancialCard }) {
  const styles: Record<string, string> = {
    balance: 'border-blue-500/30 bg-blue-500/10',
    alert:   'border-amber-500/30 bg-amber-500/10',
    goal:    'border-emerald-500/30 bg-emerald-500/10',
    tip:     'border-violet-500/30 bg-violet-500/10',
  };
  const iconColor: Record<string, string> = {
    balance: 'text-blue-400',
    alert:   'text-amber-400',
    goal:    'text-emerald-400',
    tip:     'text-violet-400',
  };
  const barColor: Record<string, string> = {
    balance: 'bg-blue-400',
    alert:   'bg-amber-400',
    goal:    'bg-emerald-400',
    tip:     'bg-violet-400',
  };
  return (
    <div className={cx('mt-2.5 rounded-xl border p-3', styles[card.type] ?? styles.tip)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={iconColor[card.type]}>{card.icon}</span>
        <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{card.title}</span>
      </div>
      {card.value    && <p className="text-base font-bold text-white">{card.value}</p>}
      {card.subtitle && <p className="text-[11px] text-white/50 mt-0.5">{card.subtitle}</p>}
      {card.progress !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-white/40">Progresso</span>
            <span className="text-[10px] font-semibold text-white/70">{card.progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={cx('h-full rounded-full', barColor[card.type] ?? 'bg-violet-400')}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, card.progress)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FluxoBadge({ tipo }: { tipo: string }) {
  const labels: Record<string, string> = {
    criar_meta: '🎯 Criar Meta', registar_gasto: '💸 Registar Gasto', analise_mensal: '📊 Análise',
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 border border-violet-500/30">
      <span className="h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
      {labels[tipo] ?? 'Fluxo activo'}
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="shrink-0 mr-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[10px] font-bold text-white shadow-lg shadow-violet-500/30">✦</div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-4 py-3 shadow-sm">
        <span className="text-violet-400 animate-pulse"><IoSparklesOutline size={11} /></span>
        <div className="flex gap-1">
          {[0, 160, 320].map(d => (
            <motion.div
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d / 1000, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <span className="text-[11px] text-white/30 select-none">A pensar…</span>
      </div>
    </div>
  );
}

// ─── Painel lateral ────────────────────────────────────────────────────────────

function SidePanel({ onClose, onSend, socketConectado }: {
  onClose: () => void;
  onSend: (cmd: string) => void;
  socketConectado: boolean;
}) {
  const [notes, setNotes]         = useState('');
  const [editNotes, setEditNotes] = useState(false);

  return (
    <motion.div
      className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-black/40 backdrop-blur-2xl"
      initial={{ x: 64, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 64, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Atalhos & Dicas</span>
        <button onClick={onClose} className="rounded-full p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors" aria-label="Fechar chat">
          <IoCloseOutline size={16} />
        </button>
      </div>

      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center px-5 py-6 border-b border-white/[0.06]">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-xl font-bold text-white shadow-lg shadow-violet-500/30 ring-4 ring-violet-500/10">✦</div>
        <h3 className="text-sm font-bold text-white">Kamba AI</h3>
        <p className="mt-0.5 text-[11px] text-white/40">Assistente Financeiro</p>
        <div className="mt-2">
          <span className={cx(
            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
            socketConectado
              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-400/20'
              : 'bg-white/[0.04] text-white/40 ring-white/10'
          )}>
            {socketConectado ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      {/* Perguntas rápidas */}
      <div className="shrink-0 px-4 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Perguntas rápidas</p>
        <div className="space-y-1">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => onSend(s.cmd)}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/90 transition-all">
              <span className="text-violet-400 shrink-0">{s.icon}</span>
              <span className="truncate">{s.label}</span>
              <span className="ml-auto shrink-0 text-white/20"><IoArrowRedoOutline size={10} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Fluxos guiados */}
      <div className="shrink-0 px-4 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Fluxos Guiados</p>
        <div className="space-y-1">
          {[
            { icon: <IoFlashOutline size={12} />,      label: 'Criar meta financeira',   cmd: 'criar meta' },
            { icon: <IoStatsChartOutline size={12} />, label: 'Registar gasto rápido',   cmd: 'registar gasto' },
            { icon: <IoBarChartOutline size={12} />,   label: 'Análise completa do mês', cmd: 'análise do mês' },
          ].map((f, i) => (
            <button key={i} onClick={() => onSend(f.cmd)}
              className="w-full flex items-center gap-2.5 rounded-xl border border-white/[0.06] px-3 py-2.5 text-left text-[12px] font-medium text-white/50 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 transition-all">
              <span className="text-violet-400/70 shrink-0">{f.icon}</span>
              <span className="truncate">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="shrink-0 px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Notas</p>
          <button onClick={() => setEditNotes(!editNotes)} className="rounded p-0.5 text-white/30 hover:text-white/60 transition-colors">
            <IoCreateOutline size={13} />
          </button>
        </div>
        {editNotes ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none placeholder:text-white/20"
              placeholder="Escreve a tua nota..." />
            <div className="flex gap-2">
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg border border-white/[0.08] py-1.5 text-[11px] font-medium text-white/40 hover:bg-white/[0.04] transition-colors">Cancelar</button>
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[11px] font-medium text-white hover:bg-violet-500 transition-colors">Guardar</button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-[12px] leading-relaxed text-white/40">{notes}</p>
        ) : (
          <button onClick={() => setEditNotes(true)} className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition-colors">
            <IoAddOutline size={13} /> Adicionar nota...
          </button>
        )}
      </div>

      {/* Dicas */}
      <div className="flex-1 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Dicas</p>
        <div className="space-y-2">
          {[
            'Usa **⏎** para enviar rapidamente.',
            'Digita **"ajuda"** para ver todos os comandos.',
            'Diz **"cancelar"** para sair de um fluxo.',
            'O Kamba nunca armazena **senhas** ou **PINs**.',
          ].map((tip, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-white/35">
                {tip.split('**').map((p, j) => j % 2 === 1 ? <strong key={j} className="text-white/60">{p}</strong> : p)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

const KambaChat: React.FC = () => {
  const reducedMotion = useReducedMotion();

  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadStoredMessages();
    return stored.length > 0 ? stored : [WELCOME_MSG];
  });

  const [fluxoAtivo, setFluxoAtivo]   = useState<string | undefined>(() => loadStoredFluxo());
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryIn, setRetryIn]         = useState(0);
  const [socketConectado, setSocketConectado] = useState(false);
  const [showPanel, setShowPanel]     = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const historyFetchedRef = useRef(false);
  const bottomRef         = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  // ── Persistência automática ────────────────────────────────────────────────
  useEffect(() => { saveStoredMessages(messages); }, [messages]);
  useEffect(() => { saveStoredFluxo(fluxoAtivo); },  [fluxoAtivo]);

  // ── Mouse tracking para aura ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // ── Histórico do backend ───────────────────────────────────────────────────
  useEffect(() => {
    if (historyFetchedRef.current) return;
    historyFetchedRef.current = true;
    const stored = loadStoredMessages();
    if (stored.length > 1) return;

    api.get('/kamba/historico')
      .then(({ data }) => {
        if (!data.success || !Array.isArray(data.historico) || data.historico.length === 0) return;
        const historico: Message[] = data.historico.map((m: {
          role: string; content: string; criadoEm?: string;
        }) => ({
          id:   `hist-${Math.random().toString(36).slice(2)}`,
          text: m.content,
          from: m.role === 'assistant' ? 'kamba' : 'user',
          time: m.criadoEm
            ? new Date(m.criadoEm).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })
            : '--:--',
          read: true,
        } as Message));
        setMessages(historico);
      })
      .catch(() => {});
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // ── Rate limit countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!rateLimited || retryIn <= 0) return;
    const t = setInterval(() => {
      setRetryIn(s => {
        if (s <= 1) { setRateLimited(false); clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimited, retryIn]);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useSocket({
    onLembrete: (d: unknown) => {
      const l = d as LembreteTempoReal;
      addMessage({
        id:   `ws-${Date.now()}`,
        text: `**${l.titulo}**\n${l.mensagem}`,
        from: 'kamba',
        time: l.dataHora
          ? new Date(l.dataHora).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })
          : nowStr(),
      });
    },
    onAlertaGasto: (d: unknown) => {
      const a = d as { mensagem?: string; percentual?: number };
      addMessage({
        id:   `ws-${Date.now()}`,
        text: a.mensagem ?? `⚠️ Já gastaste **${a.percentual ?? '—'}%** da tua renda este mês.`,
        from: 'kamba',
        time: nowStr(),
        cardData: {
          type: 'alert', title: 'Alerta de Gastos', iconType: 'warning',
          value: a.percentual ? `${a.percentual}% da renda` : undefined,
          subtitle: 'Controla o kumbú este mês!', color: 'amber',
        },
      });
    },
    onProgressoObjetivo: (d: unknown) => {
      const p = d as { tipo?: string; marca?: number; titulo?: string; progresso?: number };
      if (p.tipo !== 'progresso' || !p.marca) return;
      const labels: Record<number, string> = {
        25: `🚀 Atingiste **25%** da meta "${p.titulo}"!`,
        50: `⭐ **50%** da meta "${p.titulo}" concluída.`,
        75: `🔥 **75%** — quase lá, kamba!`,
        100:`🎉 Meta **"${p.titulo}"** concluída!`,
      };
      addMessage({
        id:   `ws-${Date.now()}`,
        text: labels[p.marca] ?? `🎯 Progresso de "${p.titulo}": ${p.progresso ?? p.marca}%`,
        from: 'kamba',
        time: nowStr(),
        cardData: p.marca === 100 ? {
          type: 'goal', title: p.titulo ?? 'Meta', iconType: 'trophy',
          subtitle: 'Objectivo atingido!', progress: 100, color: 'emerald',
        } : undefined,
      });
    },
    onConectado:    () => setSocketConectado(true),
    onDesconectado: () => setSocketConectado(false),
  });

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // ── Enviar mensagem ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (override?: string) => {
    const txt = (override ?? input).trim();
    if (!txt || isLoading || rateLimited) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    addMessage({ id: `user-${Date.now()}`, text: txt, from: 'user', time: nowStr(), read: false });
    setIsLoading(true);

    try {
      const { data } = await api.post('/kamba', { mensagem: txt });

      if (data.rateLimited) {
        setRateLimited(true);
        setRetryIn(data.tentarEm ?? 60);
        addMessage({ id: `k-${Date.now()}`, text: data.mensagem, from: 'kamba', time: nowStr() });
        return;
      }

      if (data.success) {
        if (data.fluxoAtivo) setFluxoAtivo(data.fluxoTipo);
        else                 setFluxoAtivo(undefined);

        addMessage({
          id:             `k-${Date.now()}`,
          text:           data.mensagem,
          from:           'kamba',
          time:           nowStr(),
          fluxoAtivo:     data.fluxoAtivo,
          fluxoConcluido: data.fluxoConcluido,
          fromCache:      data.fromCache,
        });
      }
    } catch {
      addMessage({ id: `k-err-${Date.now()}`, text: 'Eish, kamba! Perdi a ligação. Tenta de novo daqui a pouco. 🔌', from: 'kamba', time: nowStr() });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, rateLimited, addMessage]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex overflow-hidden bg-[#080810]" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Aura de fundo animada ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/8 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/8 rounded-full filter blur-[120px] animate-pulse" style={{ animationDelay: '700ms' }} />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-fuchsia-500/6 rounded-full filter blur-[96px] animate-pulse" style={{ animationDelay: '1200ms' }} />
      </div>

      {/* ── Aura que segue o cursor quando o input está focado ── */}
      <AnimatePresence>
        {inputFocused && (
          <motion.div
            className="pointer-events-none fixed w-[40rem] h-[40rem] rounded-full z-0 opacity-[0.025] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[80px]"
            animate={{ x: mousePosition.x - 320, y: mousePosition.y - 320 }}
            transition={{ type: 'spring', damping: 30, stiffness: 120, mass: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ══ Área de chat (full-width) ══ */}
      <div className="relative flex flex-1 flex-col overflow-hidden z-10">

        {/* Topbar */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-bold text-white shadow-lg shadow-violet-500/30">✦</div>
              <span className={cx(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080810]',
                socketConectado ? 'bg-emerald-400' : 'bg-white/20'
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-white">Kamba AI</span>
                <span className="text-violet-400"><IoSparklesOutline size={12} /></span>
                <span className={cx(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                  socketConectado
                    ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-400/20'
                    : 'bg-white/[0.04] text-white/30 ring-white/10'
                )}>
                  {socketConectado ? 'Online' : 'Offline'}
                </span>
                {fluxoAtivo && <FluxoBadge tipo={fluxoAtivo} />}
              </div>
              <p className="text-[11px] text-white/30 truncate">Assistente Financeiro Angolano</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {SUGGESTIONS.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => handleSend(s.cmd)} disabled={isLoading || rateLimited}
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors disabled:opacity-30">
                {s.icon}<span className="hidden lg:inline">{s.label}</span>
              </button>
            ))}
            {fluxoAtivo && (
              <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30">
                <IoCloseOutline size={13} /><span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
            <button onClick={() => setShowPanel(p => !p)}
              className={cx(
                'ml-1 rounded-lg p-1.5 transition-colors',
                showPanel ? 'bg-white/[0.08] text-white/70' : 'text-white/30 hover:bg-white/[0.06] hover:text-white/60'
              )}
              title="Atalhos & Dicas">
              <IoPersonOutline size={17} />
            </button>
          </div>
        </div>

        {/* Banner rate limit */}
        <AnimatePresence>
          {rateLimited && (
            <motion.div
              className="shrink-0 flex items-center gap-2 border-b border-amber-400/20 bg-amber-500/10 px-5 py-2.5"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <span className="text-amber-400 shrink-0"><IoWarningOutline size={14} /></span>
              <p className="text-[12px] text-amber-300">
                Calma, kamba! Muitas mensagens seguidas. Aguarda <strong>{retryIn}s</strong>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] font-medium text-white/20">Hoje</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {messages.map((msg, idx) => {
            const isUser  = msg.from === 'user';
            const isKamba = msg.from === 'kamba';
            const card    = cardFromSerialized(msg.cardData);
            const prevFrom = idx > 0 ? messages[idx - 1].from : null;
            const isGrouped = prevFrom === msg.from;

            if (msg.from === 'system') return (
              <div key={msg.id} className="my-3 flex items-center justify-center">
                <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-[10px] text-white/30">{msg.text}</span>
              </div>
            );

            return (
              <motion.div
                key={msg.id}
                className={cx('flex', isUser ? 'justify-end' : 'justify-start', isGrouped ? 'mt-0.5' : 'mt-3')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {/* Avatar Kamba */}
                {isKamba && (
                  <div className="shrink-0 mr-2.5 mt-auto mb-0.5">
                    {!isGrouped
                      ? <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[10px] font-bold text-white shadow-md shadow-violet-500/20">✦</div>
                      : <div className="w-7" />
                    }
                  </div>
                )}

                <div className={cx(
                  'max-w-[65%] rounded-2xl px-3.5 py-2.5',
                  isUser
                    ? 'rounded-br-sm bg-violet-600/80 text-white backdrop-blur-sm border border-violet-500/30 shadow-lg shadow-violet-500/10'
                    : 'rounded-bl-sm bg-white/[0.05] text-white/85 backdrop-blur-sm border border-white/[0.07] shadow-sm'
                )}>
                  {isKamba && !isGrouped && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-violet-400"><IoSparklesOutline size={10} /></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Kamba AI</span>
                      {msg.fromCache && <span className="text-[8px] text-white/25 italic">• cache</span>}
                    </div>
                  )}
                  <div className="text-[13px] leading-snug text-white/80">
                    <RenderText text={msg.text} isUser={isUser} />
                  </div>
                  {card && <FinancialCardInline card={card} />}
                  {msg.fluxoConcluido && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5">
                      <span className="text-emerald-400"><IoCheckmarkCircleOutline size={12} /></span>
                      <span className="text-[10px] font-semibold text-emerald-400">Concluído</span>
                    </div>
                  )}
                  <div className={cx('mt-1 flex items-center gap-1', isUser ? 'justify-end' : 'justify-start')}>
                    <span className="text-[9px] text-white/25">{msg.time}</span>
                    {isUser && (msg.read
                      ? <span className="text-violet-300/60"><IoCheckmarkDoneOutline size={10} /></span>
                      : <span className="text-white/25"><IoCheckmarkOutline size={10} /></span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div
              className="mt-3"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TypingDots />
            </motion.div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>

        {/* Chips de sugestão */}
        <AnimatePresence>
          {!fluxoAtivo && (
            <motion.div
              className="shrink-0 border-t border-white/[0.06] bg-black/20 backdrop-blur-xl px-5 pt-2.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <div className="flex gap-1.5 overflow-x-auto pb-2.5" style={{ scrollbarWidth: 'none' }}>
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    onClick={() => handleSend(s.cmd)}
                    disabled={isLoading || rateLimited}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-30"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span className="text-violet-400/70">{s.icon}</span>
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose */}
        <div className={cx(
          'shrink-0 border-t border-white/[0.06] bg-black/30 backdrop-blur-xl px-5 pb-5',
          !fluxoAtivo ? 'pt-3' : 'pt-4'
        )}>
          {/* Banner fluxo activo */}
          <AnimatePresence>
            {fluxoAtivo && (
              <motion.div
                className="mb-3 flex items-center justify-between rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[12px] font-medium text-violet-300">Fluxo guiado activo — responde à pergunta acima</span>
                </div>
                <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-200 transition-colors disabled:opacity-30">
                  <IoCloseOutline size={13} /> Cancelar
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input box */}
          <div className={cx(
            'flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all',
            'backdrop-blur-xl',
            rateLimited
              ? 'border-amber-400/20 bg-amber-500/5'
              : inputFocused
                ? 'border-violet-500/40 bg-white/[0.05] shadow-[0_0_0_3px_rgba(139,92,246,0.08)]'
                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]'
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              rows={1}
              disabled={isLoading || rateLimited}
              placeholder={
                rateLimited  ? `Aguarda ${retryIn}s antes de enviar...`
                : fluxoAtivo ? 'Responde ao Kamba… (ou "cancelar" para sair)'
                             : 'Pergunta sobre o teu saldo, gastos ou metas…'
              }
              className="min-h-[22px] flex-1 resize-none bg-transparent text-[13px] leading-snug text-white/85 outline-none placeholder:text-white/20 disabled:opacity-40"
              style={{ maxHeight: 120 }}
            />
            <div className="flex items-center gap-2 pb-0.5 shrink-0">
              {/* Microfone / Enviar */}
              {input.trim() ? (
                <motion.button
                  onClick={() => handleSend()}
                  disabled={isLoading || rateLimited}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/30 hover:bg-violet-500 disabled:opacity-40 transition-all"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  aria-label="Enviar mensagem"
                >
                  <IoPaperPlaneOutline size={14} />
                </motion.button>
              ) : (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/25 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
                  aria-label="Usar microfone"
                >
                  <IoMicOutline size={17} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[9px] text-white/15">
            IA financeira · Dados em tempo real · Kambapro
          </p>
        </div>
      </div>

      {/* ══ Painel lateral (toggle) ══ */}
      <AnimatePresence>
        {showPanel && (
          <SidePanel
            onClose={() => setShowPanel(false)}
            onSend={(cmd) => handleSend(cmd)}
            socketConectado={socketConectado}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default KambaChat;