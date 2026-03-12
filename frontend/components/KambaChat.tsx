// src/components/KambaChat.tsx
// — Sem lista lateral de conversas (chat full-width)
// — Conversa persistida em sessionStorage (sobrevive a navegação na mesma aba)
// — No mount, tenta carregar histórico do backend via GET /kamba/historico

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-icons/io5';
import api from '../services/api';
import useSocket from '../hooks/useSocket';

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

// Versão "serializável" do card (sem ReactNode) para o sessionStorage
interface FinancialCardSerialized {
  type: 'balance' | 'alert' | 'goal' | 'tip';
  title: string;
  value?: string;
  subtitle?: string;
  progress?: number;
  iconType?: string; // guarda o tipo para reidratar
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
  cardData?: FinancialCardSerialized; // armazenável em JSON
}

interface LembreteTempoReal {
  id?: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dataHora?: string;
}

// ─── Persistência sessionStorage ─────────────────────────────────────────────
// sessionStorage: por-aba, limpa ao fechar o browser → ideal para chat de sessão.
// Sobrevive a trocas de rota dentro da mesma aba (React Router, etc.).

const SESSION_MSGS_KEY  = 'kamba_msgs_v2';
const SESSION_FLUXO_KEY = 'kamba_fluxo_v2';
const MAX_STORED_MSGS   = 120;

function loadStoredMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_MSGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(
      SESSION_MSGS_KEY,
      JSON.stringify(msgs.slice(-MAX_STORED_MSGS))
    );
  } catch { /* quota excedida — silencioso */ }
}

function loadStoredFluxo(): string | undefined {
  try { return sessionStorage.getItem(SESSION_FLUXO_KEY) || undefined; }
  catch { return undefined; }
}

function saveStoredFluxo(fluxo: string | undefined) {
  try {
    if (fluxo) sessionStorage.setItem(SESSION_FLUXO_KEY, fluxo);
    else sessionStorage.removeItem(SESSION_FLUXO_KEY);
  } catch { /* silencioso */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowStr = () =>
  new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });

function cx(...cls: (string | boolean | undefined)[]) {
  return cls.filter(Boolean).join(' ');
}

// Reidrata o ícone do card a partir do tipo guardado
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
  { icon: <IoWalletOutline      size={13} />, label: 'Qual o meu saldo?',    cmd: 'Qual o meu saldo?' },
  { icon: <IoStatsChartOutline  size={13} />, label: 'Análise do mês',       cmd: 'análise do mês' },
  { icon: <IoTrophyOutline      size={13} />, label: 'Ver objetivos',        cmd: 'Como vão meus objetivos?' },
  { icon: <IoBarChartOutline    size={13} />, label: 'Gastos por categoria', cmd: 'Gastos por categoria' },
  { icon: <IoFlashOutline       size={13} />, label: 'Criar meta',           cmd: 'criar meta' },
  { icon: <IoShieldCheckmarkOutline size={13} />, label: 'Fundo emergência', cmd: 'Como está meu fundo de emergência?' },
];

const ONLINE_PILL  = 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20';
const OFFLINE_PILL = 'bg-zinc-100 text-zinc-600 ring-zinc-400/20 dark:bg-zinc-800 dark:text-zinc-400';

const WELCOME_MSG: Message = {
  id:   'welcome-0',
  text: 'Boas, kamba! 👊 Eu sou o teu assistente financeiro pessoal.\n\nPosso ajudar-te com o teu **saldo**, **gastos**, **objetivos** e muito mais. Digita **"ajuda"** para ver tudo o que posso fazer!',
  from: 'kamba',
  time: nowStr(),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Renderiza **negrito**, quebras de linha e separadores --- */
function RenderText({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <>
      {text.split('\n').map((line, li) => {
        if (line === '---') return (
          <div key={li} className={cx('my-2 border-t', isUser ? 'border-blue-400/40' : 'border-zinc-200 dark:border-zinc-700')} />
        );
        const parts = line.split('**');
        return (
          <p key={li} className={li > 0 ? 'mt-1' : ''}>
            {parts.map((part, i) =>
              i % 2 === 1
                ? <strong key={i} className={isUser ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'}>{part}</strong>
                : part
            )}
          </p>
        );
      })}
    </>
  );
}

/** Card financeiro inline na bolha */
function FinancialCardInline({ card }: { card: FinancialCard }) {
  const border: Record<string, string> = {
    balance: 'from-blue-500/10 to-blue-600/5 border-blue-200/60 dark:border-blue-500/20',
    alert:   'from-amber-500/10 to-amber-600/5 border-amber-200/60 dark:border-amber-500/20',
    goal:    'from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 dark:border-emerald-500/20',
    tip:     'from-violet-500/10 to-violet-600/5 border-violet-200/60 dark:border-violet-500/20',
  };
  const icon: Record<string, string> = {
    balance: 'text-blue-500', alert: 'text-amber-500',
    goal: 'text-emerald-500', tip: 'text-violet-500',
  };
  return (
    <div className={cx('mt-2 rounded-xl border bg-gradient-to-br p-3', border[card.type] ?? border.tip)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={icon[card.type]}>{card.icon}</span>
        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{card.title}</span>
      </div>
      {card.value    && <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">{card.value}</p>}
      {card.subtitle && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{card.subtitle}</p>}
      {card.progress !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Progresso</span>
            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">{card.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={cx('h-full rounded-full transition-all duration-700', card.type === 'goal' ? 'bg-emerald-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, card.progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Badge de fluxo wizard activo */
function FluxoBadge({ tipo }: { tipo: string }) {
  const labels: Record<string, string> = {
    criar_meta: '🎯 Criar Meta', registar_gasto: '💸 Registar Gasto', analise_mensal: '📊 Análise',
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
      <span className="h-1 w-1 rounded-full bg-violet-500 animate-pulse" />
      {labels[tipo] ?? 'Fluxo activo'}
    </span>
  );
}

/** Três pontos animados de "a pensar" */
function TypingDots() {
  return (
    <div className="flex justify-start animate-in fade-in duration-200">
      <div className="shrink-0 mr-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[9px] font-bold text-white">✦</div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-zinc-100 bg-white px-3.5 py-2.5 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800">
        <span className="text-violet-500 animate-pulse"><IoSparklesOutline size={10} /></span>
        <div className="flex gap-1">
          {[0, 160, 320].map(d => (
            <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 select-none">A pensar…</span>
      </div>
    </div>
  );
}

// ─── Painel lateral de atalhos ─────────────────────────────────────────────────

function SidePanel({ onClose, onSend, socketConectado }: {
  onClose: () => void;
  onSend: (cmd: string) => void;
  socketConectado: boolean;
}) {
  const [notes, setNotes]         = useState('');
  const [editNotes, setEditNotes] = useState(false);

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Atalhos & Dicas</span>
        <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 transition-colors">
          <IoCloseOutline size={16} />
        </button>
      </div>

      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-xl font-bold text-white shadow-md ring-4 ring-violet-100 dark:ring-violet-500/20">✦</div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Kamba AI</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">Assistente Financeiro</p>
        <div className="mt-2">
          <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', socketConectado ? ONLINE_PILL : OFFLINE_PILL)}>
            {socketConectado ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Perguntas rápidas */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Perguntas rápidas</p>
        <div className="space-y-1.5">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => onSend(s.cmd)}
              className="w-full flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 text-left text-[12px] font-medium text-zinc-700 hover:bg-violet-50 hover:text-violet-700 transition-colors dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-400">
              <span className="text-violet-500 shrink-0">{s.icon}</span>
              <span className="truncate">{s.label}</span>
              <IoArrowRedoOutline size={11} className="ml-auto shrink-0 text-zinc-300 dark:text-zinc-600" />
            </button>
          ))}
        </div>
      </div>

      {/* Fluxos guiados */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Fluxos Guiados</p>
        <div className="space-y-1.5">
          {[
            { icon: <IoFlashOutline size={12} />,      label: 'Criar meta financeira',   cmd: 'criar meta' },
            { icon: <IoStatsChartOutline size={12} />, label: 'Registar gasto rápido',   cmd: 'registar gasto' },
            { icon: <IoBarChartOutline size={12} />,   label: 'Análise completa do mês', cmd: 'análise do mês' },
          ].map((f, i) => (
            <button key={i} onClick={() => onSend(f.cmd)}
              className="w-full flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[12px] font-medium text-zinc-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:bg-violet-500/10 dark:hover:text-violet-400">
              <span className="text-violet-400 shrink-0">{f.icon}</span>
              <span className="truncate">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Notas</p>
          <button onClick={() => setEditNotes(!editNotes)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors">
            <IoCreateOutline size={13} />
          </button>
        </div>
        {editNotes ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-900 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 transition-colors">Cancelar</button>
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg bg-zinc-900 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">Guardar</button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">{notes}</p>
        ) : (
          <button onClick={() => setEditNotes(true)} className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors">
            <IoAddOutline size={13} /> Adicionar nota...
          </button>
        )}
      </div>

      {/* Dicas */}
      <div className="flex-1 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Dicas</p>
        <div className="space-y-2">
          {[
            'Usa **⏎** para enviar rapidamente.',
            'Digita **"ajuda"** para ver todos os comandos.',
            'Diz **"cancelar"** para sair de um fluxo a qualquer momento.',
            'O Kamba nunca armazena **senhas** ou **PINs**.',
          ].map((tip, i) => (
            <div key={i} className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {tip.split('**').map((p, j) => j % 2 === 1 ? <strong key={j} className="text-zinc-700 dark:text-zinc-300">{p}</strong> : p)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

const KambaChat: React.FC = () => {

  // ── Estado — inicializa a partir do sessionStorage ─────────────────────────
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadStoredMessages();
    // Se há mensagens guardadas (além da welcome), usa-as directamente
    return stored.length > 0 ? stored : [WELCOME_MSG];
  });

  const [fluxoAtivo, setFluxoAtivo]   = useState<string | undefined>(() => loadStoredFluxo());
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryIn, setRetryIn]         = useState(0);
  const [socketConectado, setSocketConectado] = useState(false);
  const [showPanel, setShowPanel]     = useState(true);

  // Flag para não repetir o carregamento do histórico do backend
  const historyFetchedRef = useRef(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Persistência automática ────────────────────────────────────────────────
  // Grava no sessionStorage sempre que messages ou fluxoAtivo mudam.
  // Assim, ao navegar para outra rota e voltar, o estado é recuperado.
  useEffect(() => { saveStoredMessages(messages); }, [messages]);
  useEffect(() => { saveStoredFluxo(fluxoAtivo); },  [fluxoAtivo]);

  // ── Carrega histórico do backend na primeira montagem ──────────────────────
  // Só corre se o sessionStorage estiver vazio (utilizador recarregou a página
  // ou abriu numa aba nova). Permite recuperar conversas de sessões anteriores.
  useEffect(() => {
    if (historyFetchedRef.current) return;
    historyFetchedRef.current = true;

    // Se já temos mensagens reais no storage, não precisamos do backend
    const stored = loadStoredMessages();
    if (stored.length > 1) return; // > 1 porque a welcome msg conta como 1

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

        // Substitui a welcome msg pelo histórico real do utilizador
        setMessages(historico);
      })
      .catch(() => {
        // Endpoint ainda não existe → fica com a welcome msg. Sem erro visível.
      });
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // ── Countdown rate limit ───────────────────────────────────────────────────
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

  // ── Helper: adiciona mensagem ──────────────────────────────────────────────
  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // ── WebSocket — notificações proativas ────────────────────────────────────
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
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
    <div className="-m-4 md:-m-6 flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ══ Área de chat (full-width) ══ */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900">

        {/* Topbar */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-bold text-white shadow-sm">✦</div>
              <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900', socketConectado ? 'bg-emerald-500' : 'bg-zinc-400')} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Kamba AI</span>
                <span className="text-violet-500"><IoSparklesOutline size={12} /></span>
                <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', socketConectado ? ONLINE_PILL : OFFLINE_PILL)}>
                  {socketConectado ? 'Online' : 'Offline'}
                </span>
                {fluxoAtivo && <FluxoBadge tipo={fluxoAtivo} />}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">Assistente Financeiro Angolano</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Atalhos rápidos no header */}
            {SUGGESTIONS.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => handleSend(s.cmd)} disabled={isLoading || rateLimited}
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
                {s.icon}<span className="hidden lg:inline">{s.label}</span>
              </button>
            ))}
            {/* Cancelar fluxo */}
            {fluxoAtivo && (
              <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40">
                <IoCloseOutline size={13} /><span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
            {/* Toggle painel */}
            <button onClick={() => setShowPanel(p => !p)}
              className={cx('ml-1 rounded-lg p-1.5 transition-colors', showPanel ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800')}
              title="Atalhos & Dicas">
              <IoPersonOutline size={17} />
            </button>
          </div>
        </div>

        {/* Banner rate limit */}
        {rateLimited && (
          <div className="shrink-0 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-400/20 dark:bg-amber-500/10">
            <IoWarningOutline size={14} className="text-amber-500 shrink-0" />
            <p className="text-[12px] text-amber-700 dark:text-amber-400">
              Calma, kamba! Muitas mensagens seguidas. Aguarda <strong>{retryIn}s</strong>.
            </p>
          </div>
        )}

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-[#f7f8fa] px-4 py-3 dark:bg-zinc-950">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Hoje</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {messages.map((msg, idx) => {
            const isUser  = msg.from === 'user';
            const isKamba = msg.from === 'kamba';
            const card    = cardFromSerialized(msg.cardData);

            // Agrupa mensagens consecutivas do mesmo remetente (menos espaço entre elas)
            const prevFrom = idx > 0 ? messages[idx - 1].from : null;
            const isGrouped = prevFrom === msg.from;

            if (msg.from === 'system') return (
              <div key={msg.id} className="my-2 flex items-center justify-center">
                <span className="rounded-full bg-zinc-200/80 px-3 py-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{msg.text}</span>
              </div>
            );

            return (
              <div key={msg.id} className={cx(
                'flex animate-in fade-in slide-in-from-bottom-1 duration-200',
                isUser ? 'justify-end' : 'justify-start',
                isGrouped ? 'mt-0.5' : 'mt-3'
              )}>
                {/* Avatar Kamba — só na primeira mensagem de cada grupo */}
                {isKamba && (
                  <div className="shrink-0 mr-2 mt-auto mb-0.5">
                    {!isGrouped
                      ? <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-[9px] font-bold text-white shadow-sm">✦</div>
                      : <div className="w-6" /> /* espaçador para alinhar */
                    }
                  </div>
                )}
                <div className={cx(
                  'max-w-[62%] rounded-2xl px-3 py-2 shadow-sm',
                  isUser
                    ? 'rounded-br-sm bg-blue-600 text-white'
                    : 'rounded-bl-sm bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700/50'
                )}>
                  {isKamba && !isGrouped && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-violet-500"><IoSparklesOutline size={10} /></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-violet-500">Kamba AI</span>
                      {msg.fromCache && <span className="text-[8px] text-zinc-400 italic">• cache</span>}
                    </div>
                  )}
                  <div className="text-[13px] leading-snug">
                    <RenderText text={msg.text} isUser={isUser} />
                  </div>
                  {card && <FinancialCardInline card={card} />}
                  {msg.fluxoConcluido && (
                    <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-500/10">
                      <IoCheckmarkCircleOutline size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Concluído</span>
                    </div>
                  )}
                  <div className={cx('mt-0.5 flex items-center gap-1', isUser ? 'justify-end' : 'justify-start')}>
                    <span className={cx('text-[9px]', isUser ? 'text-blue-200' : 'text-zinc-400 dark:text-zinc-500')}>{msg.time}</span>
                    {isUser && (msg.read
                      ? <span className="text-blue-200"><IoCheckmarkDoneOutline size={10} /></span>
                      : <span className="text-blue-300"><IoCheckmarkOutline size={10} /></span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="mt-3">
              <TypingDots />
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>

        {/* Chips de sugestão */}
        {!fluxoAtivo && (
          <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pt-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => handleSend(s.cmd)} disabled={isLoading || rateLimited}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-violet-500/10 dark:hover:text-violet-400">
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compose */}
        <div className={cx('shrink-0 border-t border-zinc-200 bg-white px-4 pb-4 dark:border-zinc-800 dark:bg-zinc-900', !fluxoAtivo ? 'pt-2' : 'pt-3')}>
          {fluxoAtivo && (
            <div className="mb-2.5 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 dark:bg-violet-500/10">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-[12px] font-medium text-violet-700 dark:text-violet-300">Fluxo guiado activo — responde à pergunta acima</span>
              </div>
              <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                className="flex items-center gap-1 text-[11px] text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-40">
                <IoCloseOutline size={13} /> Cancelar
              </button>
            </div>
          )}
          <div className={cx(
            'flex items-end gap-2 rounded-2xl border px-3.5 py-2.5 transition-all focus-within:ring-2',
            rateLimited
              ? 'border-amber-300/60 bg-amber-50/60 focus-within:ring-amber-400/10 dark:border-amber-400/20 dark:bg-amber-500/5'
              : 'border-zinc-200 bg-zinc-50/70 focus-within:border-violet-400/50 focus-within:bg-white focus-within:ring-violet-400/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:focus-within:bg-zinc-800'
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              rows={1}
              disabled={isLoading || rateLimited}
              placeholder={
                rateLimited  ? `Aguarda ${retryIn}s antes de enviar...`
                : fluxoAtivo ? 'Responde ao Kamba... (ou "cancelar" para sair)'
                             : 'Pergunta sobre o teu saldo, gastos ou metas… (⏎ para enviar)'
              }
              className="min-h-[22px] flex-1 resize-none bg-transparent text-[13px] leading-snug text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              style={{ maxHeight: 100 }}
            />
            {input.trim()
              ? <button onClick={() => handleSend()} disabled={isLoading || rateLimited}
                  className="mb-0.5 shrink-0 rounded-full bg-violet-600 p-1.5 text-white transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50">
                  <IoPaperPlaneOutline size={13} />
                </button>
              : <button className="mb-0.5 shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors">
                  <IoMicOutline size={17} />
                </button>
            }
          </div>
          <p className="mt-1.5 text-center text-[9px] text-zinc-400 dark:text-zinc-600">
            IA financeira · Dados em tempo real · Kambapro
          </p>
        </div>
      </div>

      {/* ══ Painel lateral de atalhos (toggle) ══ */}
      {showPanel && (
        <SidePanel
          onClose={() => setShowPanel(false)}
          onSend={(cmd) => handleSend(cmd)}
          socketConectado={socketConectado}
        />
      )}
    </div>
  );
};

export default KambaChat;