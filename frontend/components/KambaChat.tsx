// src/components/KambaChat.tsx
// — Visual alinhado ao design system da KambaPro
// — Glassmorphism, Framer Motion e cores baseadas em variáveis CSS
// — Conversa persistida em sessionStorage e histórico carregado do backend

import React, { useState, useRef, useEffect, useCallback } from 'react';

// Provide a minimal JSX.IntrinsicElements declaration to satisfy TS when the
// project's TSX/JSX config is not picking up built-in JSX types.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react/jsx-runtime';

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
} from 'react-icons/io5';
import kambaService from '../services/kambaService';
import useSocket from '../hooks/useSocket';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

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
    case 'trophy':  return <IoTrophyOutline  size={14} />;m
    case 'wallet':  return <IoWalletOutline  size={14} />;
    default:        return <IoSparklesOutline size={14} />;
  }
}

function cardFromSerialized(cd?: FinancialCardSerialized): FinancialCard | undefined {
  if (!cd) return undefined;
  return { ...cd, icon: rehydrateCardIcon(cd.iconType) };
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'kv'; items: Array<{ label: string; value: string }> }
  | { type: 'wizard'; action: string; payload: Record<string, unknown> }
  | { type: 'code'; language?: string; content: string }
  | { type: 'rule' }
  | { type: 'table'; header: string[]; rows: string[][] };

function normalizeMessageText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\u00a0/g, ' ');
}

function parseWizardPayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid wizard payloads
  }

  return { raw };
}

function wizardLabel(action: string) {
  const labels: Record<string, string> = {
    criar_meta: 'Criar Meta',
    registar_gasto: 'Registar Gasto',
    registar_cartao: 'Registar Cartão',
    analise_mensal: 'Análise Mensal',
  };

  return labels[action] ?? action.replace(/_/g, ' ');
}

function isSafeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseInline(text: string, isUser: boolean, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[\s\S]+?\*\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\*([^*\n]+)\*|_([^_\n]+)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  const pushPlain = (segment: string) => {
    if (!segment) return;
    nodes.push(segment);
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('**')) {
      nodes.push(
        <strong
          key={key}
          className="font-bold"
          style={{ color: isUser ? 'var(--accent-text)' : 'var(--text-primary)' }}
        >
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded-md border px-1.5 py-0.5 text-[0.92em]"
          style={{
            backgroundColor: isUser ? 'rgba(255,255,255,0.14)' : 'var(--bg-elevated)',
            borderColor: isUser ? 'rgba(255,255,255,0.12)' : 'var(--border)',
            color: isUser ? 'var(--accent-text)' : 'var(--text-primary)',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      const label = match[2];
      const url = match[3];
      if (label && url && isSafeUrl(url)) {
        nodes.push(
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-80"
            style={{ color: isUser ? 'var(--accent-text)' : 'var(--accent)' }}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('*')) {
      nodes.push(
        <em
          key={key}
          className="italic"
          style={{ color: isUser ? 'var(--accent-text)' : 'var(--text-primary)' }}
        >
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('_')) {
      nodes.push(
        <em
          key={key}
          className="italic"
          style={{ color: isUser ? 'var(--accent-text)' : 'var(--text-primary)' }}
        >
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }

  return nodes;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function parseBlocks(text: string): MarkdownBlock[] {
  const lines = normalizeMessageText(text).split('\n');
  const blocks: MarkdownBlock[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let quoteLines: string[] = [];
  let kvItems: Array<{ label: string; value: string }> = [];
  let codeLines: string[] = [];
  let tableLines: string[] = [];
  let inCode = false;
  let codeLanguage: string | undefined;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...paragraph] });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', ordered: listOrdered, items: [...listItems] });
      listItems = [];
    }
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      blocks.push({ type: 'quote', lines: [...quoteLines] });
      quoteLines = [];
    }
  };

  const flushKeyValues = () => {
    if (kvItems.length > 0) {
      blocks.push({ type: 'kv', items: [...kvItems] });
      kvItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const header = splitTableRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitTableRow).filter((row) => row.length > 0);
      blocks.push({ type: 'table', header, rows });
    }
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', language: codeLanguage, content: codeLines.join('\n') });
        codeLines = [];
        codeLanguage = undefined;
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        flushKeyValues();
        flushTable();
        inCode = true;
        codeLanguage = trimmed.slice(3).trim() || undefined;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      flushList();
      flushQuote();
      flushKeyValues();
      flushTable();
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      flushParagraph();
      flushList();
      flushQuote();
      flushKeyValues();
      flushTable();
      blocks.push({ type: 'rule' });
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      flushKeyValues();
      flushTable();
      const level = Math.min(3, trimmed.match(/^#{1,3}/)?.[0].length ?? 1) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, content: trimmed.replace(/^#{1,3}\s+/, '').trim() });
      continue;
    }

    const listMatch = trimmed.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      flushQuote();
      flushKeyValues();
      flushTable();
      const ordered = /\d+\./.test(listMatch[2]);
      if (listItems.length === 0) listOrdered = ordered;
      if (listOrdered !== ordered && listItems.length > 0) {
        flushList();
        listOrdered = ordered;
      }
      listItems.push(listMatch[3].trim());
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      flushKeyValues();
      flushTable();
      quoteLines.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }

    const wizardMatch = trimmed.match(/^\[WIZARD:([a-z_]+):(\{.*\})\]$/);
    if (wizardMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      flushKeyValues();
      flushTable();
      blocks.push({
        type: 'wizard',
        action: wizardMatch[1],
        payload: parseWizardPayload(wizardMatch[2]),
      });
      continue;
    }

    const kvMatch = trimmed.match(/^(?:\*\*)?([^:\n]{1,60}?)(?:\*\*)?:\s+(.+)$/);
    if (
      kvMatch &&
      !/^https?:\/\//i.test(trimmed) &&
      kvMatch[1].trim().length > 0 &&
      kvMatch[1].trim().length <= 40 &&
      kvMatch[2].trim().length > 0
    ) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();
      kvItems.push({
        label: kvMatch[1].trim().replace(/^\*\*|\*\*$/g, ''),
        value: kvMatch[2].trim(),
      });
      continue;
    }

    if (kvItems.length > 0) {
      flushKeyValues();
    }

    const nextLine = lines[i + 1];
    if (line.includes('|') && nextLine && isTableSeparator(nextLine.trim())) {
      flushParagraph();
      flushList();
      flushQuote();
      flushKeyValues();
      tableLines.push(trimmed);
      i += 1;
      continue;
    }

    if (tableLines.length > 0) {
      if (line.includes('|')) {
        tableLines.push(trimmed);
        continue;
      }
      flushTable();
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  if (inCode) {
    blocks.push({ type: 'code', language: codeLanguage, content: codeLines.join('\n') });
  }

  flushParagraph();
  flushList();
  flushQuote();
  flushKeyValues();
  flushTable();

  return blocks;
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
  const blocks = parseBlocks(text);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const baseKey = `block-${blockIndex}`;

        if (block.type === 'rule') {
          return (
            <div
              key={baseKey}
              className="my-2 h-px w-full"
              style={{ backgroundColor: 'var(--border)' }}
            />
          );
        }

        if (block.type === 'heading') {
          const headingClass =
            block.level === 1
              ? 'text-lg'
              : block.level === 2
                ? 'text-base'
                : 'text-sm';

          return (
            <div key={baseKey} className="space-y-1">
              <p
                className={cx('font-extrabold tracking-tight', headingClass)}
                style={{ color: isUser ? 'var(--accent-text)' : 'var(--text-primary)' }}
              >
                {parseInline(block.content, isUser, `${baseKey}-heading`)}
              </p>
            </div>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <p key={baseKey} className="leading-relaxed">
              {block.lines.map((line, lineIndex) => (
                <React.Fragment key={`${baseKey}-${lineIndex}`}>
                  {lineIndex > 0 && <br />}
                  {parseInline(line, isUser, `${baseKey}-p-${lineIndex}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={baseKey}
              className="rounded-xl border-l-4 px-4 py-3"
              style={{
                borderColor: isUser ? 'rgba(255,255,255,0.3)' : 'var(--accent-30)',
                backgroundColor: isUser ? 'rgba(255,255,255,0.08)' : 'var(--bg-elevated)',
              }}
            >
              <div className="space-y-1">
                {block.lines.map((line, lineIndex) => (
                  <p key={`${baseKey}-q-${lineIndex}`} className="leading-relaxed">
                    {parseInline(line, isUser, `${baseKey}-q-${lineIndex}`)}
                  </p>
                ))}
              </div>
            </blockquote>
          );
        }

        if (block.type === 'kv') {
          return (
            <div
              key={baseKey}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <div>
                {block.items.map((item, itemIndex) => (
                  <div
                    key={`${baseKey}-kv-${itemIndex}`}
                    className={cx(
                      'grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-3 px-4 py-3',
                      itemIndex > 0 && 'border-t',
                    )}
                    style={itemIndex > 0 ? { borderColor: 'var(--border)' } : undefined}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                      {parseInline(item.label, isUser, `${baseKey}-kv-${itemIndex}-label`)}
                    </div>
                    <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {parseInline(item.value, isUser, `${baseKey}-kv-${itemIndex}-value`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === 'wizard') {
          const entries = Object.entries(block.payload);
          return (
            <div
              key={baseKey}
              className="overflow-hidden rounded-2xl border shadow-sm"
              style={{ borderColor: 'var(--accent-20)', backgroundColor: 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))' }}
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--accent-20)' }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: 'var(--accent)' }}>
                    Próximo passo
                  </p>
                  <p className="mt-1 text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {wizardLabel(block.action)}
                  </p>
                </div>
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--accent)', borderColor: 'var(--accent-20)', backgroundColor: 'var(--accent-10)' }}
                >
                  Wizard
                </span>
              </div>

              {entries.length > 0 ? (
                <div className="divide-y" style={{ divideColor: 'var(--accent-15)' }}>
                  {entries.map(([key, value]) => (
                    <div key={`${baseKey}-${key}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-3 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {typeof value === 'string'
                          ? parseInline(value, isUser, `${baseKey}-wizard-${key}`)
                          : Array.isArray(value)
                            ? value.join(', ')
                            : value !== null && typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Ação estruturada detectada.
                </div>
              )}
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <div key={baseKey} className="space-y-2">
              {block.language && (
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                  {block.language}
                </div>
              )}
              <pre
                className="overflow-x-auto rounded-xl border px-4 py-3 text-[12px] leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <code className="font-mono">{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={baseKey} className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="min-w-full border-collapse text-left text-[12px]">
                <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={`${baseKey}-h-${cellIndex}`}
                        className="px-3 py-2 font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {parseInline(cell, isUser, `${baseKey}-h-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${baseKey}-r-${rowIndex}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${baseKey}-r-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top" style={{ color: 'var(--text-muted)' }}>
                          {parseInline(cell, isUser, `${baseKey}-r-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag
              key={baseKey}
              className={cx(
                'space-y-2',
                block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5',
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${baseKey}-item-${itemIndex}`} className="leading-relaxed">
                  {parseInline(item, isUser, `${baseKey}-item-${itemIndex}`)}
                </li>
              ))}
            </Tag>
          );
        }

        return null;
      })}
    </div>
  );
}

function FinancialCardInline({ card }: { card: FinancialCard }) {
  const styles: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    balance: { border: 'rgba(59,130,246,0.2)', bg: 'rgba(59,130,246,0.1)', text: 'var(--text-primary)', icon: '#60a5fa' },
    alert:   { border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.1)', text: 'var(--text-primary)', icon: '#f59e0b' },
    goal:    { border: 'rgba(16,185,129,0.2)', bg: 'rgba(16,185,129,0.1)', text: 'var(--text-primary)', icon: '#10b981' },
    tip:     { border: 'var(--border-strong)', bg: 'var(--bg-elevated)',   text: 'var(--text-primary)', icon: 'var(--accent)' },
  };
  const s = styles[card.type] ?? styles.tip;
  return (
    <div className="mt-2.5 rounded-xl border p-3 shadow-sm" style={{ borderColor: s.border, backgroundColor: s.bg }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ color: s.icon }}>{card.icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: 'var(--text-primary)' }}>{card.title}</span>
      </div>
      {card.value    && <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</p>}
      {card.subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{card.subtitle}</p>}
      {card.progress !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Progresso</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{card.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: s.icon }}
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
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border"
      style={{ backgroundColor: 'var(--accent-10)', color: 'var(--accent)', borderColor: 'var(--accent-20)' }}>
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
      {labels[tipo] ?? 'Fluxo activo'}
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="shrink-0 mr-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl font-bold shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'var(--accent-text)' }}>✦</div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm backdrop-blur-xl"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <span className="animate-pulse" style={{ color: 'var(--accent)' }}><IoSparklesOutline size={12} /></span>
        <div className="flex gap-1">
          {[0, 160, 320].map(d => (
            <motion.div
              key={d}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--accent)' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d / 1000, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <span className="text-[11px] select-none ml-1" style={{ color: 'var(--text-faint)' }}>A pensar…</span>
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
      className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l backdrop-blur-2xl"
      style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-base) 80%, transparent)' }}
      initial={{ x: 240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 240, opacity: 0 }}
      transition={springSmooth}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Atalhos & Dicas</span>
        <button onClick={onClose} className="rounded-lg p-1 transition-colors" style={{ color: 'var(--text-faint)' }} aria-label="Fechar painel">
          <IoCloseOutline size={18} className="hover:text-white" />
        </button>
      </div>

      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center px-5 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <motion.div 
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-xl"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'var(--accent-text)' }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >✦</motion.div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Kamba AI</h3>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>Assistente Financeiro</p>
        <div className="mt-3">
          <span className={cx(
            'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all',
            socketConectado
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
          )}>
            {socketConectado ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      {/* Perguntas rápidas */}
      <div className="shrink-0 px-3 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Perguntas rápidas</p>
        <div className="space-y-1">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => onSend(s.cmd)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition-all hover:bg-white/[0.04]"
              style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent)' }} className="shrink-0">{s.icon}</span>
              <span className="truncate flex-1">{s.label}</span>
              <IoArrowRedoOutline size={12} className="opacity-20" />
            </button>
          ))}
        </div>
      </div>

      {/* Fluxos guiados */}
      <div className="shrink-0 px-3 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Fluxos Guiados</p>
        <div className="space-y-1">
          {[
            { icon: <IoFlashOutline size={12} />,      label: 'Criar meta financeira',   cmd: 'criar meta' },
            { icon: <IoStatsChartOutline size={12} />, label: 'Registar gasto rápido',   cmd: 'registar gasto' },
            { icon: <IoBarChartOutline size={12} />,   label: 'Análise completa do mês', cmd: 'análise do mês' },
          ].map((f, i) => (
            <button key={i} onClick={() => onSend(f.cmd)}
              className="w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-30)'; e.currentTarget.style.backgroundColor = 'var(--accent-10)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <span className="shrink-0">{f.icon}</span>
              <span className="truncate">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="shrink-0 px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Notas</p>
          <button onClick={() => setEditNotes(!editNotes)} className="rounded p-1 transition-colors hover:bg-white/10" style={{ color: 'var(--text-faint)' }}>
            <IoCreateOutline size={14} />
          </button>
        </div>
        {editNotes ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full rounded-xl border px-3 py-2 text-[12px] outline-none transition-all resize-none"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="Escreve a tua nota..." />
            <div className="flex gap-2">
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg py-1.5 text-[11px] font-bold border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancelar</button>
              <button onClick={() => setEditNotes(false)} className="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors shadow-sm"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>Guardar</button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{notes}</p>
        ) : (
          <button onClick={() => setEditNotes(true)} className="flex items-center gap-1.5 text-[12px] transition-colors" style={{ color: 'var(--text-faint)' }}>
            <IoAddOutline size={14} /> Adicionar nota...
          </button>
        )}
      </div>

      {/* Dicas */}
      <div className="flex-1 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Dicas</p>
        <div className="space-y-2">
          {[
            'Usa **⏎** para enviar rapidamente.',
            'Digita **"ajuda"** para ver comandos.',
            'Diz **"cancelar"** para sair de fluxos.',
          ].map((tip, i) => (
            <div key={i} className="rounded-xl border px-3 py-2.5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                {tip.split('**').map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'var(--text-muted)' }}>{p}</strong> : p)}
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
  const { maskValue, formatMoney } = useTheme();

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

    kambaService.obterHistorico()
      .then((data) => {
        if (!data.success || !Array.isArray(data.historico) || data.historico.length === 0) return;
        const historico: Message[] = data.historico.map((m) => ({
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

  // ── Auto-focus management ──────────────────────────────────────────────────
  const focusInput = useCallback(() => {
    if (!isLoading && !rateLimited) {
      textareaRef.current?.focus();
    }
  }, [isLoading, rateLimited]);

  // Initial focus
  useEffect(() => {
    const timer = setTimeout(focusInput, 500); // Small delay for layout/animation
    return () => clearTimeout(timer);
  }, [focusInput]);

  // Focus after loading or rate limit ends
  useEffect(() => {
    if (!isLoading && !rateLimited) focusInput();
  }, [isLoading, rateLimited, focusInput]);

  // Global keydown to catch typing even if blurred
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      // Only focus on letter, number, or common typing keys
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        focusInput();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusInput]);

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
      const data = await kambaService.enviarMensagem(txt);

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
      focusInput(); // Re-focus after response
    }
  }, [input, isLoading, rateLimited, addMessage, focusInput]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* ── Aura de fundo animada ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full filter blur-[140px] opacity-20 animate-pulse" 
          style={{ backgroundColor: 'var(--accent)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full filter blur-[120px] opacity-10 animate-pulse" 
          style={{ backgroundColor: 'var(--accent)', animationDelay: '700ms' }} />
      </div>

      {/* ── Aura que segue o cursor quando o input está focado ── */}
      <AnimatePresence>
        {inputFocused && (
          <motion.div
            className="pointer-events-none fixed w-[600px] h-[600px] rounded-full z-0 opacity-[0.05] blur-[100px]"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
            animate={{ x: mousePosition.x - 300, y: mousePosition.y - 300 }}
            transition={{ type: 'spring', damping: 40, stiffness: 100, mass: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* ══ Área de chat (full-width) ══ */}
      <div className="relative flex flex-1 flex-col overflow-hidden z-10" onClick={focusInput}>

        {/* Topbar */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b backdrop-blur-2xl px-5 py-3" 
          style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <motion.div 
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'var(--accent-text)' }}
                whileHover={{ scale: 1.05, rotate: 5 }}
              >✦</motion.div>
              <span className={cx(
                'absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2',
                socketConectado ? 'bg-emerald-400' : 'bg-zinc-500'
              )} style={{ borderColor: 'var(--bg-surface)' }} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Kamba AI</span>
                <span style={{ color: 'var(--accent)' }}><IoSparklesOutline size={12} /></span>
                <span className={cx(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                  socketConectado
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                )}>
                  {socketConectado ? 'Online' : 'Offline'}
                </span>
                {fluxoAtivo && <FluxoBadge tipo={fluxoAtivo} />}
              </div>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>Assistente Financeiro Angolano</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {SUGGESTIONS.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => handleSend(s.cmd)} disabled={isLoading || rateLimited}
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-30 border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-20)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {s.icon}<span className="hidden lg:inline">{s.label}</span>
              </button>
            ))}
            {fluxoAtivo && (
              <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-30 border"
                style={{ borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)', color: '#f87171' }}
              >
                <IoCloseOutline size={14} /><span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
            <button onClick={() => setShowPanel(p => !p)}
              className="ml-1 rounded-xl p-2 transition-all border shadow-sm"
              style={{ 
                backgroundColor: showPanel ? 'var(--accent)' : 'var(--bg-surface)', 
                borderColor: showPanel ? 'var(--accent)' : 'var(--border)',
                color: showPanel ? 'var(--accent-text)' : 'var(--text-muted)' 
              }}
              title="Atalhos & Dicas">
              <IoPersonOutline size={18} />
            </button>
          </div>
        </div>

        {/* Banner rate limit */}
        <AnimatePresence>
          {rateLimited && (
            <motion.div
              className="shrink-0 flex items-center gap-3 border-b px-5 py-2.5"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <IoWarningOutline size={16} className="text-amber-500 shrink-0" />
              <p className="text-[12px] font-medium text-amber-200">
                Calma, kamba! Muitas mensagens seguidas. Aguarda <strong className="font-bold">{retryIn}s</strong>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border)' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-faint)' }}>Hoje</span>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border)' }} />
          </div>

          {messages.map((msg, idx) => {
            const isUser  = msg.from === 'user';
            const isKamba = msg.from === 'kamba';
            const card    = cardFromSerialized(msg.cardData);
            const prevFrom = idx > 0 ? messages[idx - 1].from : null;
            const isGrouped = prevFrom === msg.from;

            if (msg.from === 'system') return (
              <div key={msg.id} className="my-4 flex items-center justify-center">
                <span className="rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" 
                  style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-faint)' }}>{msg.text}</span>
              </div>
            );

            return (
              <motion.div
                key={msg.id}
                className={cx('flex', isUser ? 'justify-end' : 'justify-start', isGrouped ? 'mt-1' : 'mt-5')}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={springSmooth}
              >
                {/* Avatar Kamba */}
                {isKamba && (
                  <div className="shrink-0 mr-3 mt-auto mb-1">
                    {!isGrouped
                      ? <motion.div 
                          className="flex h-8 w-8 items-center justify-center rounded-xl font-bold shadow-lg"
                          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'var(--accent-text)' }}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                        >✦</motion.div>
                      : <div className="w-8" />
                    }
                  </div>
                )}

                <div className={cx(
                  'max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 shadow-sm border transition-all',
                  isUser
                    ? 'rounded-br-sm text-white backdrop-blur-md'
                    : 'rounded-bl-sm backdrop-blur-md'
                )} style={{
                  backgroundColor: isUser ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor: isUser ? 'var(--accent-20)' : 'var(--border)',
                  color: isUser ? 'var(--accent-text)' : 'var(--text-primary)'
                }}>
                  {isKamba && !isGrouped && (
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: 'var(--accent)' }}><IoSparklesOutline size={12} /></span>
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Kamba AI</span>
                      {msg.fromCache && <span className="text-[9px] opacity-30 italic font-medium ml-1"># cache</span>}
                    </div>
                  )}
                  <div className="text-[14px] leading-relaxed font-medium opacity-90">
                    <RenderText text={msg.text} isUser={isUser} />
                  </div>
                  {card && <FinancialCardInline card={card} />}
                  {msg.fluxoConcluido && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 border"
                      style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <IoCheckmarkCircleOutline size={16} className="text-emerald-400" />
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Acção Concluída</span>
                    </div>
                  )}
                  <div className={cx('mt-1.5 flex items-center gap-1.5', isUser ? 'justify-end' : 'justify-start')}>
                    <span className="text-[9px] font-bold opacity-30 uppercase">{msg.time}</span>
                    {isUser && (msg.read
                      ? <span className="opacity-60" style={{ color: 'var(--accent-text)' }}><IoCheckmarkDoneOutline size={12} /></span>
                      : <span className="opacity-30" style={{ color: 'var(--accent-text)' }}><IoCheckmarkOutline size={12} /></span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div
              className="mt-5"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TypingDots />
            </motion.div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Chips de sugestão */}
        <AnimatePresence>
          {!fluxoAtivo && (
            <motion.div
              className="shrink-0 border-t backdrop-blur-2xl px-5 pt-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-surface) 40%, transparent)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    onClick={() => handleSend(s.cmd)}
                    disabled={isLoading || rateLimited}
                    className="flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-bold transition-all disabled:opacity-30 shadow-sm"
                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.05, borderColor: 'var(--accent-30)', color: 'var(--accent)' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="opacity-70">{s.icon}</span>
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose */}
        <div className={cx(
          'shrink-0 border-t backdrop-blur-3xl px-5 pb-6',
          !fluxoAtivo ? 'pt-3' : 'pt-5'
        )} style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)' }}>
          {/* Banner fluxo activo */}
          <AnimatePresence>
            {fluxoAtivo && (
              <motion.div
                className="mb-4 flex items-center justify-between rounded-xl border px-4 py-2.5 shadow-sm"
                style={{ backgroundColor: 'var(--accent-10)', borderColor: 'var(--accent-20)' }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
                  <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Fluxo activo — aguardando a tua resposta</span>
                </div>
                <button onClick={() => handleSend('cancelar')} disabled={isLoading}
                  className="flex items-center gap-1.5 text-[11px] font-bold transition-colors opacity-70 hover:opacity-100"
                  style={{ color: 'var(--accent)' }}>
                  <IoCloseOutline size={16} /> Cancelar
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input box */}
          <div className={cx(
            'flex items-end gap-3 rounded-2xl border px-4 py-3.5 transition-all shadow-sm',
            'backdrop-blur-2xl',
            rateLimited
              ? 'border-amber-500/30 bg-amber-500/5'
              : inputFocused
                ? 'shadow-[0_0_0_4px_var(--accent-10)]'
                : 'hover:border-white/10'
          )} style={{ 
            borderColor: inputFocused ? 'var(--accent-40)' : 'var(--border)', 
            backgroundColor: 'var(--bg-elevated)' 
          }}>
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
                rateLimited  ? `Aguarda ${retryIn}s…`
                : fluxoAtivo ? 'Responde ao Kamba…'
                             : 'Pergunta algo ao Kamba…'
              }
              className="min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-white/10 disabled:opacity-40 font-medium"
              style={{ maxHeight: 120, color: 'var(--text-primary)' }}
            />
            <div className="flex items-center gap-2 pb-0.5 shrink-0">
              {input.trim() ? (
                <motion.button
                  onClick={() => handleSend()}
                  disabled={isLoading || rateLimited}
                  className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-all disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                  whileHover={{ scale: 1.08, backgroundColor: 'var(--accent-hover)' }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Enviar"
                >
                  <IoPaperPlaneOutline size={16} />
                </motion.button>
              ) : (
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-all opacity-20 hover:opacity-50 hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                  aria-label="Voz"
                >
                  <IoMicOutline size={20} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 opacity-20">
            <div className="h-px w-8 bg-current" />
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] whitespace-nowrap">IA Financeira · KambaPro</p>
            <div className="h-px w-8 bg-current" />
          </div>
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
