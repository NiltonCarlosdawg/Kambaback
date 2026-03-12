// src/components/NotificacoesDrawer.tsx
import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Notificacao, getIconeParaTipo, tempoRelativo } from '../hooks/useNotificacoes';
import { useTheme } from '../contexts/ThemeContext';

interface NotificacoesDrawerProps {
  open: boolean; onClose: () => void;
  notificacoes: Notificacao[]; totalNaoLidas: number;
  loading: boolean; onMarcarLida: (id: string) => void; onMarcarTodasLidas: () => void;
}

// ─── Item component ───────────────────────────────────────────────────────────
const NotificacaoItem: React.FC<{ notificacao: Notificacao; onMarcarLida: (id: string) => void }> = ({ notificacao, onMarcarLida }) => {
  const icone = getIconeParaTipo(notificacao.tipo);
  return (
    <div
      className="flex gap-3.5 px-4 py-3.5 cursor-pointer group transition-all"
      style={{
        backgroundColor: notificacao.lida ? 'transparent' : 'var(--accent-10)',
        borderBottom: '1px solid var(--border)',
        borderLeft: notificacao.lida ? '2px solid transparent' : '2px solid var(--accent)',
      }}
      onMouseEnter={e => { (e.currentTarget).style.backgroundColor = notificacao.lida ? 'var(--bg-elevated)' : 'var(--accent-15)'; }}
      onMouseLeave={e => { (e.currentTarget).style.backgroundColor = notificacao.lida ? 'transparent' : 'var(--accent-10)'; }}
      onClick={() => !notificacao.lida && onMarcarLida(notificacao.id)}
    >
      {/* Icon bubble */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ring-1 ring-inset"
        style={{
          backgroundColor: notificacao.lida ? 'var(--bg-elevated)' : 'var(--accent-10)',
          ringColor: notificacao.lida ? 'var(--border)' : 'var(--accent-20)',
        }}>
        {icone}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold truncate"
            style={{ color: notificacao.lida ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {notificacao.titulo}
          </p>
          <span className="text-[10px] flex-shrink-0 mt-0.5 font-medium" style={{ color: 'var(--text-faint)' }}>
            {tempoRelativo(notificacao.criadoEm)}
          </span>
        </div>
        <p className="text-[11px] mt-0.5 leading-relaxed line-clamp-2"
          style={{ color: notificacao.lida ? 'var(--text-faint)' : 'var(--text-muted)' }}>
          {notificacao.corpo}
        </p>
        {!notificacao.lida && (
          <button
            onClick={e => { e.stopPropagation(); onMarcarLida(notificacao.id); }}
            className="text-[10px] font-bold mt-1.5 transition-all opacity-0 group-hover:opacity-100"
            style={{ color: 'var(--accent)' }}>
            Marcar como lida →
          </button>
        )}
      </div>

      {/* Unread dot */}
      {!notificacao.lida && (
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
      )}
    </div>
  );
};

// ─── Drawer ───────────────────────────────────────────────────────────────────
const NotificacoesDrawer: React.FC<NotificacoesDrawerProps> = ({
  open, onClose, notificacoes, totalNaoLidas, loading, onMarcarLida, onMarcarTodasLidas,
}) => {
  const { prefs } = useTheme();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose(); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-full sm:w-[400px] z-50 flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-strong)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-inset"
                style={{ backgroundColor: 'var(--accent-10)', ringColor: 'var(--accent-20)' }}>
                <Bell size={18} style={{ color: 'var(--accent)' }} />
              </div>
              {totalNaoLidas > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] text-[10px] font-black rounded-full flex items-center justify-center px-1"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                  {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Notificações</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {totalNaoLidas > 0 ? `${totalNaoLidas} não lida${totalNaoLidas !== 1 ? 's' : ''}` : 'Tudo em dia 👊'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalNaoLidas > 0 && (
              <button onClick={onMarcarTodasLidas} disabled={loading}
                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--accent-10)'; }}
                onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                <CheckCheck size={14} />
                {loading ? '…' : 'Todas'}
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; (e.currentTarget).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget).style.backgroundColor = 'transparent'; (e.currentTarget).style.color = 'var(--text-faint)'; }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: 'var(--bg-elevated)' }}>🔔</div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Sem notificações</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>Quando o Kamba tiver alertas para ti, aparecem aqui.</p>
              </div>
            </div>
          ) : (
            <div>
              {notificacoes.map(notif => (
                <NotificacaoItem key={notif.id} notificacao={notif} onMarcarLida={onMarcarLida} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificacoesDrawer;