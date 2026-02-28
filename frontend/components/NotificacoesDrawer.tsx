// src/components/NotificacoesDrawer.tsx
import React, { useEffect, useRef } from 'react';
import { Notificacao, getIconeParaTipo, getCorParaTipo, tempoRelativo } from '../hooks/useNotificacoes';
import { useTheme } from '../contexts/ThemeContext';

interface NotificacoesDrawerProps {
  open: boolean;
  onClose: () => void;
  notificacoes: Notificacao[];
  totalNaoLidas: number;
  loading: boolean;
  onMarcarLida: (id: string) => void;
  onMarcarTodasLidas: () => void;
}

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
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderLeft:      '1px solid var(--border-strong)',
          transform:       open ? 'translateX(0)' : 'translateX(100%)',
          transition:      'transform var(--transition-speed, 200ms) ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-10)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              {totalNaoLidas > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] text-[10px] font-black rounded-full flex items-center justify-center px-1"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                  {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-black text-base" style={{ color: 'var(--text-primary)' }}>Notificações</h2>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {totalNaoLidas > 0 ? `${totalNaoLidas} não lida${totalNaoLidas !== 1 ? 's' : ''}` : 'Tudo em dia 👊'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalNaoLidas > 0 && (
              <button onClick={onMarcarTodasLidas} disabled={loading}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                {loading ? '…' : 'Marcar todas'}
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: 'var(--bg-elevated)' }}>🔔</div>
              <div>
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Sem notificações</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Quando o Kamba tiver alertas para ti, aparecem aqui.</p>
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

const NotificacaoItem: React.FC<{ notificacao: Notificacao; onMarcarLida: (id: string) => void }> = ({ notificacao, onMarcarLida }) => {
  const { prefs } = useTheme();
  const icone = getIconeParaTipo(notificacao.tipo);

  return (
    <div
      className="flex gap-4 px-6 py-4 cursor-pointer group transition-all"
      style={{
        backgroundColor: notificacao.lida ? 'transparent' : 'var(--accent-10)',
        borderBottom:     '1px solid var(--border)',
        borderLeft:       notificacao.lida ? 'none' : '2px solid var(--accent)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = notificacao.lida ? 'rgba(255,255,255,0.02)' : 'var(--accent-15)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = notificacao.lida ? 'transparent' : 'var(--accent-10)'; }}
      onClick={() => !notificacao.lida && onMarcarLida(notificacao.id)}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ backgroundColor: notificacao.lida ? 'rgba(255,255,255,0.05)' : 'var(--accent-10)' }}>
        {icone}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold truncate" style={{ color: notificacao.lida ? 'var(--text-faint)' : 'var(--text-primary)' }}>
            {notificacao.titulo}
          </p>
          <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {tempoRelativo(notificacao.criadoEm)}
          </span>
        </div>
        <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: notificacao.lida ? 'var(--text-faint)' : 'var(--text-muted)' }}>
          {notificacao.corpo}
        </p>
        {!notificacao.lida && (
          <button
            onClick={e => { e.stopPropagation(); onMarcarLida(notificacao.id); }}
            className="text-[10px] font-bold mt-1.5 transition-colors opacity-0 group-hover:opacity-100"
            style={{ color: 'var(--accent)' }}>
            Marcar como lida →
          </button>
        )}
      </div>

      {/* Unread dot */}
      {!notificacao.lida && (
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2 animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
      )}
    </div>
  );
};

export default NotificacoesDrawer;