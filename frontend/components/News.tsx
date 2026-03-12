// src/components/News.tsx
import React, { useEffect, useState } from 'react';
import { Calendar, Cpu, ExternalLink, Globe, Newspaper, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Artigo {
  titulo: string; descricao: string; fonte: string;
  url: string; imagem: string; publicadoEm: string;
}

// ─── Shared inline components ────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }> = ({ children, className = '', style, onClick }) => (
  <div className={`rounded-2xl border shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', ...style }}
    onClick={onClick}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
    <div>
      {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>{subtitle}</p>}
      <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    {right}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const News: React.FC = () => {
  const { formatDate } = useTheme();
  const [artigos,    setArtigos]    = useState<Artigo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [categoria,  setCategoria]  = useState('business');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => { fetchNoticias(); }, [categoria]);

  const fetchNoticias = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/noticias?categoria=${categoria}`);
      setArtigos(data.artigos || []);
      if (data.atualizadoEm) setLastUpdate(new Date(data.atualizadoEm).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const categorias = [
    { id: 'business',   label: 'Negócios',   Icon: TrendingUp   },
    { id: 'technology', label: 'Tecnologia', Icon: Cpu  },
    { id: 'general',    label: 'Mundo',      Icon: Globe         },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)', opacity: 0.6 }}>Feed</p>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--text-primary)' }}>
            <Newspaper size={28} style={{ color: 'var(--accent)' }} />
            Notícias & Insights
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            Fica a par do que move a economia {lastUpdate && `· Atualizado às ${lastUpdate}`}
          </p>
        </div>

        {/* Category tabs */}
        <Card style={{ padding: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {categorias.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setCategoria(id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
              style={{
                backgroundColor: categoria === id ? 'var(--accent)' : 'transparent',
                color: categoria === id ? 'var(--accent-text)' : 'var(--text-muted)',
              }}>
              <Icon size={14} />
              {label}
            </button>
          ))}
          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />
          <button onClick={fetchNoticias} title="Atualizar"
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; (e.currentTarget).style.backgroundColor = 'var(--bg-elevated)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; (e.currentTarget).style.backgroundColor = 'transparent'; }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </Card>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="overflow-hidden">
              <div className="h-44 animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="p-4 space-y-2.5">
                <div className="h-3 rounded-full w-3/4 animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)' }} />
                <div className="h-3 rounded-full w-1/2 animate-pulse" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              </div>
            </Card>
          ))}
        </div>
      ) : artigos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {artigos.map((a, i) => (
            <article key={i} className="flex flex-col h-full group transition-all"
              style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = 'var(--border-strong)'; (e.currentTarget).style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = 'var(--border)'; (e.currentTarget).style.boxShadow = 'none'; }}>

              {/* Image */}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="relative h-44 overflow-hidden block flex-shrink-0">
                <img src={a.imagem} alt={a.titulo}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/600x400/111/333?text=KambaPro'; }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                {/* Source badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ring-1 ring-inset"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', ringColor: 'rgba(255,255,255,0.2)' }}>
                  {a.fonte}
                </div>
              </a>

              {/* Content */}
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex items-center gap-1.5 text-[11px] mb-2.5 font-medium" style={{ color: 'var(--text-faint)' }}>
                  <Calendar size={12} />
                  <span>{formatDate(a.publicadoEm)}</span>
                </div>
                <h3 className="text-sm font-bold mb-2 line-clamp-2 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    onMouseEnter={e => { (e.currentTarget).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-primary)'; }}>
                    {a.titulo}
                  </a>
                </h3>
                <p className="text-[12px] line-clamp-3 mb-4 flex-grow leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {a.descricao}
                </p>
                <div className="pt-3 mt-auto border-t" style={{ borderColor: 'var(--border)' }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors group/link"
                    style={{ color: 'var(--accent)' }}>
                    Ler artigo completo
                    <ExternalLink size={13} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card style={{ padding: '80px 24px', textAlign: 'center', border: '2px dashed var(--border)' }}>
          <Newspaper size={40} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sem notícias no momento</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tenta mudar de categoria ou atualizar.</p>
        </Card>
      )}
    </div>
  );
};

export default News;