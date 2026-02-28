// src/components/KambaChat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';
import { KambaMessage } from '../types';
import useSocket from '../hooks/useSocket';
import { useTheme } from '../contexts/ThemeContext';

interface LembreteTempoReal {
  id?: string; tipo: string; titulo: string; mensagem: string; dataHora?: string;
}

const KambaChat: React.FC = () => {
  const { prefs } = useTheme();

  const [messages, setMessages] = useState<KambaMessage[]>([{
    sender: 'kamba',
    text: 'Boas, kamba! Eu sou o teu assistente financeiro. Queres saber o teu saldo, ver o último gasto ou precisas de uma dica?',
    timestamp: new Date().toISOString(),
  }]);
  const [input,            setInput]            = useState('');
  const [isLoading,        setIsLoading]        = useState(false);
  const [socketConectado,  setSocketConectado]  = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const pushMsg = useCallback((text: string, ts?: string) => {
    setMessages(prev => [...prev, { sender: 'kamba', text, timestamp: ts || new Date().toISOString() }]);
  }, []);

  const handleLembrete        = useCallback((d: unknown) => { const l = d as LembreteTempoReal; pushMsg(`**${l.titulo}**\n${l.mensagem}`, l.dataHora); }, [pushMsg]);
  const handleAlertaGasto     = useCallback((d: unknown) => { const a = d as any; pushMsg(a.mensagem || `⚠️ Já gastaste **${a.percentual}%** da tua renda.`); }, [pushMsg]);
  const handleProgressoObjetivo = useCallback((d: unknown) => {
    const p = d as any;
    if (p.tipo === 'progresso' && p.marca) {
      const m: Record<number, string> = { 25: `🚀 Atingiste **25%** da meta "${p.titulo}"!`, 50: `⭐ **50%** da meta "${p.titulo}" concluída!`, 75: `🔥 **75%** — quase lá!`, 100: `🎉 Meta "${p.titulo}" **concluída!**` };
      pushMsg(m[p.marca] || `🎯 Progresso "${p.titulo}": ${p.progresso}%`);
    }
  }, [pushMsg]);

  useSocket({
    onLembrete: handleLembrete, onAlertaGasto: handleAlertaGasto, onProgressoObjetivo: handleProgressoObjetivo,
    onConectado: () => setSocketConectado(true), onDesconectado: () => setSocketConectado(false),
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: KambaMessage = { sender: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const { data } = await api.post('/kamba', { mensagem: userMsg.text, historico: messages.map(m => ({ sender: m.sender, text: m.text })) });
      if (data.success) pushMsg(data.mensagem);
    } catch {
      pushMsg('Desculpa kamba, fiquei sem sinal. Tenta de novo daqui a pouco.');
    } finally { setIsLoading(false); }
  };

  const renderMensagem = (text: string, isUser: boolean) =>
    text.split('\n').map((linha, li) => {
      if (linha === '---') return <hr key={li} className="border-white/10 my-2" />;
      const partes = linha.split('**');
      return (
        <p key={li} className={li > 0 ? 'mt-1' : ''}>
          {partes.map((part, i) =>
            i % 2 === 1
              ? <strong key={i} style={{ color: isUser ? '#fff' : 'var(--accent)' }}>{part}</strong>
              : part
          )}
        </p>
      );
    });

  return (
    <div
      className="flex flex-col max-w-4xl mx-auto shadow-2xl overflow-hidden"
      style={{
        height:          'calc(100vh - 140px)',
        backgroundColor: 'var(--bg-surface)',
        border:          '1px solid var(--border)',
        borderRadius:    16,
      }}
    >
      {/* Header — uses accent colour */}
      <div
        className="p-6 flex items-center gap-4 flex-shrink-0"
        style={{
          background:  `linear-gradient(135deg, var(--accent), var(--accent-dark))`,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent-text)' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 rounded-full transition-colors ${socketConectado ? 'bg-green-500' : 'bg-gray-500'}`}
            style={{ borderColor: 'var(--accent)' }} />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-lg" style={{ color: 'var(--accent-text)' }}>Kamba AI</h3>
          <p className="text-sm font-medium" style={{ color: 'var(--accent-text)', opacity: 0.7 }}>Assistente Inteligente Angolano</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <div className={`w-2 h-2 rounded-full ${socketConectado ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs font-bold" style={{ color: 'var(--accent-text)' }}>{socketConectado ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ background: isUser ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : `linear-gradient(135deg, var(--accent), var(--accent-dark))` }}>
                  {isUser ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" style={{ color: 'var(--accent-text)' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  )}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1">
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                    style={isUser
                      ? { background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' }
                      : { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }
                    }>
                    {renderMensagem(msg.text, isUser)}
                  </div>
                  <span className={`text-[10px] px-2 ${isUser ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-faint)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading dots */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: `linear-gradient(135deg, var(--accent), var(--accent-dark))` }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent-text)' }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm shadow-lg flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex gap-1">
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: 'var(--accent)', animationDelay: `${delay}ms` }} />
                  ))}
                </div>
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Kamba está a pensar…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <div className="flex gap-3">
          <input
            type="text" value={input} placeholder="Pergunta sobre o teu saldo, gastos ou pede uma dica…"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
            disabled={isLoading}
            className="flex-1 rounded-2xl px-5 py-4 text-sm outline-none transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border:          '1px solid var(--border-strong)',
              color:           'var(--text-primary)',
            }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'var(--border-strong)'; }}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}
            className="p-4 rounded-2xl transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        {/* Quick suggestions */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {['💰 Qual o meu saldo?', '📊 Últimos gastos', '💡 Dica financeira', '🎯 Progresso dos objetivos'].map((s, i) => (
            <button key={i} onClick={() => setInput(s.substring(2).trim())} disabled={isLoading}
              className="px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50 flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-20)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KambaChat;