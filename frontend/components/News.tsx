// src/components/News.tsx
import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Calendar, RefreshCcw, TrendingUp, Globe, Cpu } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Artigo {
  titulo: string; descricao: string; fonte: string;
  url: string; imagem: string; publicadoEm: string;
}

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
    { id: 'business',   label: 'Negócios',   Icon: TrendingUp },
    { id: 'technology', label: 'Tecnologia', Icon: Cpu        },
    { id: 'general',    label: 'Mundo',      Icon: Globe      },
  ];

  const card: React.CSSProperties = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Newspaper style={{ color: 'var(--accent)' }} size={28} />
            Notícias & Insights
          </h2>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            Fica a par do que move a economia {lastUpdate && `• Atualizado às ${lastUpdate}`}
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 p-2 rounded-2xl overflow-x-auto max-w-full"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {categorias.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setCategoria(id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
              style={{
                backgroundColor: categoria === id ? 'var(--accent)' : 'transparent',
                color:           categoria === id ? 'var(--accent-text)' : 'var(--text-muted)',
                boxShadow:       categoria === id ? '0 0 15px var(--accent-20)' : 'none',
              }}>
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button onClick={fetchNoticias} title="Atualizar"
            className="p-2.5 rounded-xl transition-all ml-1"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'; }}>
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="p-4 rounded-2xl animate-pulse" style={card}>
              <div className="h-48 rounded-xl mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
              <div className="h-4 rounded w-3/4 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
              <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
            </div>
          ))}
        </div>
      ) : artigos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artigos.map((a, i) => (
            <article key={i}
              className="flex flex-col h-full group transition-all"
              style={{ ...card, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px var(--accent-10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
              {/* Image */}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="relative h-48 overflow-hidden block flex-shrink-0">
                <img src={a.imagem} alt={a.titulo}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/600x400/111/444?text=KambaPro'; }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-black shadow-lg"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                  {a.fonte}
                </div>
              </a>

              {/* Content */}
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-xs mb-3 font-medium" style={{ color: 'var(--text-faint)' }}>
                  <Calendar size={14} />
                  <span>{formatDate(a.publicadoEm)}</span>
                </div>
                <h3 className="text-lg font-black mb-2 line-clamp-2 transition-colors" style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.titulo}</a>
                </h3>
                <p className="text-sm line-clamp-3 mb-4 flex-grow leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {a.descricao}
                </p>
                <div className="pt-4 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold transition-colors group/link"
                    style={{ color: 'var(--accent)' }}>
                    Ler artigo completo
                    <ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border)' }}>
          <Newspaper className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--text-faint)' }} />
          <h3 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Sem notícias no momento</h3>
          <p className="font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Tenta mudar de categoria ou atualizar.</p>
        </div>
      )}
    </div>
  );
};

export default News;