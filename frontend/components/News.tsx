// src/components/News.tsx
import React, { useEffect, useState } from 'react';
import { Calendar, Cpu, ExternalLink, Globe, Landmark, MapPin, Newspaper, RefreshCw } from 'lucide-react';
import newsService, { Artigo } from '../services/newsService';
import { useTheme } from '../contexts/ThemeContext';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-3xl border ${className}`} style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
    {children}
  </div>
);

const CATEGORIES = [
  { id: 'geral',   label: 'Geral',      icon: Globe },
  { id: 'angola',  label: 'Angola',     icon: MapPin },
  { id: 'financas',label: 'Finanças',   icon: Landmark },
  { id: 'tech',    label: 'Tecnologia', icon: Cpu },
];

const News: React.FC = () => {
  const { formatDate } = useTheme();
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [resumo,  setResumo]  = useState('');
  const [loading, setLoading] = useState(true);
  const [cat,      setCat]      = useState('geral');

  const fetchNews = async () => {
    try {
      setLoading(true);
      const [newsRes, resRes] = await Promise.all([
        newsService.obterNoticias(cat),
        newsService.obterResumo(cat).catch(() => null)
      ]);
      setArtigos(newsRes.data?.artigos || []);
      setResumo(resRes?.data?.resumo || '');
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNews(); }, [cat]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Notícias do Mercado</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Mantém-te informado sobre economia e tecnologia.</p>
        </div>
        <button onClick={fetchNews} className="p-2 rounded-xl border hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 border ${cat === c.id ? '' : 'hover:bg-white/5'}`}
            style={{ 
              backgroundColor: cat === c.id ? 'var(--accent)' : 'var(--bg-surface)', 
              borderColor: cat === c.id ? 'var(--accent)' : 'var(--border)',
              color: cat === c.id ? 'var(--accent-text)' : 'var(--text-muted)'
            }}>
            <c.icon size={14} />
            {c.label}
          </button>
        ))}
      </div>

      {resumo && !loading && (
        <Card className="p-6 border-l-4 border-l-accent" style={{ borderColor: 'var(--accent)' }}>
          <div className="flex items-center gap-3 mb-4">
            <Newspaper size={20} style={{ color: 'var(--accent)' }} />
            <h3 className="font-bold uppercase tracking-widest text-[10px]" style={{ color: 'var(--text-faint)' }}>Resumo da IA</h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{resumo}</p>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 rounded-3xl animate-pulse bg-white/[0.03]" />)}
        </div>
      ) : artigos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artigos.map((a, i) => (
            <Card key={i} className="group overflow-hidden flex flex-col hover:border-accent/40 transition-colors">
              {a.imagem && (
                <div className="h-40 overflow-hidden bg-white/[0.02]">
                  <img src={a.imagem} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                  <span>{a.fonte}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(a.publicadoEm)}</span>
                </div>
                <h4 className="font-bold leading-tight group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>{a.titulo}</h4>
                <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{a.descricao}</p>
                <div className="pt-2 mt-auto">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1.5 text-xs font-bold transition-all hover:gap-2" style={{ color: 'var(--accent)' }}>
                    Ler artigo completo <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-20 text-center">
          <Newspaper size={48} className="mx-auto mb-4 opacity-10" />
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Sem notícias no momento</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tenta mudar de categoria ou atualizar.</p>
        </Card>
      )}
    </div>
  );
};

export default News;
