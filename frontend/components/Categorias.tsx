// src/components/Categorias.tsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

type TipoCategoria = 'ESSENCIAL' | 'FLEXIVEL' | 'POUPANCA' | 'RENDIMENTO';

interface Categoria {
  id: string; nome: string; tipo: TipoCategoria; cor: string;
  icone?: string; padrao: boolean; ordem?: number; ativa?: boolean;
}

interface CategoriaForm { nome: string; tipo: TipoCategoria; cor: string; icone: string; }

const TIPO_CONFIG: Record<TipoCategoria, { label: string; labelPlural: string; descricao: string; cor: string; iconePadrao: string; exemplos: string[] }> = {
  ESSENCIAL:  { label: 'Essencial',   labelPlural: 'Essenciais',   descricao: 'Despesas obrigatórias para viver',    cor: '#ef4444', iconePadrao: 'home',       exemplos: ['Renda', 'Luz', 'Água', 'Comida'] },
  FLEXIVEL:   { label: 'Flexível',    labelPlural: 'Flexíveis',    descricao: 'Despesas que podes controlar',        cor: '#8b5cf6', iconePadrao: 'gamepad-2',  exemplos: ['Lazer', 'Restaurantes', 'Compras'] },
  POUPANCA:   { label: 'Poupança',    labelPlural: 'Poupanças',    descricao: 'Dinheiro guardado para o futuro',    cor: '#14b8a6', iconePadrao: 'shield',      exemplos: ['Fundo emergência', 'Investimentos', 'Metas'] },
  RENDIMENTO: { label: 'Rendimento',  labelPlural: 'Rendimentos',  descricao: 'Entradas de dinheiro',               cor: '#10b981', iconePadrao: 'briefcase',   exemplos: ['Salário', 'Freelance', 'Negócio'] },
};

const ICONES_SVG: Record<string, string> = {
  'home':            'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  'utensils':        'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  'car':             'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 6H1l2 7h10l2-7zM11 6l-2 7h10l-2-7',
  'graduation-cap':  'M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5',
  'gamepad-2':       'M6 11h4M8 9v4m5-4h.01m3.99 0h.01M18 8a6 6 0 016 6 6 6 0 01-12 0 6 6 0 016-6z',
  'shopping-bag':    'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 11-8 0',
  'plane':           'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  'shield':          'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'trending-up':     'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  'target':          'M22 12h-4m-2 0a4 4 0 11-8 0 4 4 0 018 0zm0 0a6 6 0 11-12 0 6 6 0 0112 0zm0 0a8 8 0 11-16 0 8 8 0 0116 0z',
  'briefcase':       'M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5z',
  'laptop':          'M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16',
  'store':           'M3 21h18M6 18h12M6 6l1.5-2h9L18 6M3 6h18v4a3 3 0 01-3 3H6a3 3 0 01-3-3V6z',
  'gift':            'M20 12v10H4V12M2 7h20v5H2z M12 22V7m0 0H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
  'wallet':          'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  'tag':             'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
};

const renderIcon = (name: string, cls = 'w-5 h-5') => {
  const d = ICONES_SVG[name] || ICONES_SVG['tag'];
  return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
};

const Categorias: React.FC = () => {
  const { prefs } = useTheme();

  const [categorias,  setCategorias]  = useState<Categoria[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tipoFiltro,  setTipoFiltro]  = useState<TipoCategoria>('ESSENCIAL');
  const [showModal,   setShowModal]   = useState(false);
  const [error,       setError]       = useState('');
  const [editMode,    setEditMode]    = useState(false);
  const [currentId,   setCurrentId]   = useState<string | null>(null);
  const [formData,    setFormData]    = useState<CategoriaForm>({ nome: '', tipo: 'ESSENCIAL', cor: TIPO_CONFIG['ESSENCIAL'].cor, icone: TIPO_CONFIG['ESSENCIAL'].iconePadrao });

  useEffect(() => { fetchCategorias(); }, []);

  const fetchCategorias = async () => {
    try {
      setLoading(true); setError('');
      const { data } = await api.get('/categorias');
      setCategorias(data.categorias || []);
    } catch (err: any) { setError(err.response?.data?.mensagemAmigavel || err.response?.data?.message || 'Erro ao carregar categorias'); }
    finally { setLoading(false); }
  };

  const handleOpenModal = (cat?: Categoria) => {
    setError('');
    if (cat) {
      setEditMode(true); setCurrentId(cat.id);
      setFormData({ nome: cat.nome, tipo: cat.tipo, cor: cat.cor || TIPO_CONFIG[cat.tipo].cor, icone: cat.icone || TIPO_CONFIG[cat.tipo].iconePadrao });
      setTipoFiltro(cat.tipo);
    } else {
      setEditMode(false); setCurrentId(null);
      setFormData({ nome: '', tipo: tipoFiltro, cor: TIPO_CONFIG[tipoFiltro].cor, icone: TIPO_CONFIG[tipoFiltro].iconePadrao });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      let cor = formData.cor.startsWith('#') ? formData.cor : `#${formData.cor}`;
      cor = cor.toLowerCase();
      if (editMode && currentId) { await api.patch(`/categorias/${currentId}`, { nome: formData.nome.trim(), cor, icone: formData.icone }); }
      else { await api.post('/categorias', { nome: formData.nome.trim(), tipo: formData.tipo, cor, icone: formData.icone }); }
      setShowModal(false); fetchCategorias();
    } catch (err: any) { setError(err.response?.data?.mensagemAmigavel || err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Remover "${nome}"?`)) return;
    try { await api.delete(`/categorias/${id}`); fetchCategorias(); }
    catch (err: any) { alert(err.response?.data?.message || 'Erro ao eliminar'); }
  };

  const handleTipoChange = (t: TipoCategoria) => {
    setTipoFiltro(t);
    if (!editMode) setFormData(prev => ({ ...prev, tipo: t, cor: TIPO_CONFIG[t].cor, icone: TIPO_CONFIG[t].iconePadrao }));
  };

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipoFiltro);

  const inp: React.CSSProperties = { width: '100%', height: 48, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', color: 'var(--text-primary)', outline: 'none', transition: 'box-shadow 200ms' };
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as any, cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' };
  const fa = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = '0 0 0 1px var(--accent)'; };
  const fb = (e: React.FocusEvent<any>) => { e.target.style.boxShadow = 'none'; };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Carregando categorias…</p>
      </div>
    </div>
  );

  if (error && categorias.length === 0) return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-red-400 text-center">{error}</p>
      <button onClick={fetchCategorias} className="px-6 py-2 rounded-full font-bold transition-all" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>Tentar Novamente</button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Organiza as tuas finanças por categorias</p>
        <button onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.99]"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nova Categoria
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TIPO_CONFIG) as TipoCategoria[]).map(tipo => {
          const isActive = tipoFiltro === tipo;
          return (
            <button key={tipo} onClick={() => handleTipoChange(tipo)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                color:           isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                boxShadow:       isActive ? '0 0 20px var(--accent-20)' : 'none',
                border:          isActive ? 'none' : '1px solid var(--border)',
              }}>
              <div className="flex items-center gap-2">
                {renderIcon(TIPO_CONFIG[tipo].iconePadrao, 'w-4 h-4')}
                <span>{TIPO_CONFIG[tipo].labelPlural}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info box */}
      <div className="p-6 rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: TIPO_CONFIG[tipoFiltro].cor }}>
            {renderIcon(TIPO_CONFIG[tipoFiltro].iconePadrao)}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{TIPO_CONFIG[tipoFiltro].labelPlural}</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{TIPO_CONFIG[tipoFiltro].descricao}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Exemplos:</span>
              {TIPO_CONFIG[tipoFiltro].exemplos.map((ex, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{ex}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {categoriasFiltradas.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: `${TIPO_CONFIG[tipoFiltro].cor}30` }}>
              {renderIcon(TIPO_CONFIG[tipoFiltro].iconePadrao, 'w-8 h-8')}
            </div>
            <div>
              <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Nenhuma categoria {TIPO_CONFIG[tipoFiltro].label.toLowerCase()}</h3>
              <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 font-medium text-sm transition-colors" style={{ color: 'var(--accent)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Criar categoria
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoriasFiltradas.map(cat => (
            <div key={cat.id} className="p-5 rounded-2xl group transition-all"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0" style={{ backgroundColor: cat.cor }}>
                    {renderIcon(cat.icone || 'tag', 'w-6 h-6')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cat.nome}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full inline-block mt-1" style={{ backgroundColor: `${cat.cor}30`, color: cat.cor }}>
                      {TIPO_CONFIG[cat.tipo].label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                  {cat.padrao ? (
                    <span className="p-2" style={{ color: 'var(--text-faint)' }} title="Padrão do sistema">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                  ) : (
                    <>
                      <button onClick={() => handleOpenModal(cat)} className="p-2 rounded-lg transition-colors text-blue-400 hover:bg-blue-500/20">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(cat.id, cat.nome)} className="p-2 rounded-lg transition-colors text-red-400 hover:bg-red-500/20">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{editMode ? 'Editar' : 'Nova'} Categoria</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-faint)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {error && <div className="mb-4 p-3 rounded-lg text-sm text-red-400 bg-red-900/20 border border-red-500/30 flex items-center gap-2">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo display */}
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tipo</label>
                  <div className="p-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: TIPO_CONFIG[formData.tipo].cor }}>
                      {renderIcon(TIPO_CONFIG[formData.tipo].iconePadrao, 'w-4 h-4')}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{TIPO_CONFIG[formData.tipo].label}</span>
                    {editMode && <span className="text-xs ml-auto" style={{ color: 'var(--text-faint)' }}>(não editável)</span>}
                  </div>
                </div>
                {/* Nome */}
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nome *</label>
                  <input type="text" required placeholder="Ex: Supermercado, Netflix…" maxLength={40} value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} style={inp} onFocus={fa} onBlur={fb} />
                </div>
                {/* Cor + Ícone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cor</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formData.cor} onChange={e => setFormData({ ...formData, cor: e.target.value })}
                        className="w-12 h-12 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }} />
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formData.cor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ícone</label>
                    <select value={formData.icone} onChange={e => setFormData({ ...formData, icone: e.target.value })} style={sel} onFocus={fa} onBlur={fb}>
                      {Object.keys(ICONES_SVG).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                {/* Preview */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Pré-visualização:</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: formData.cor }}>
                      {renderIcon(formData.icone)}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formData.nome || 'Nome da categoria'}</span>
                  </div>
                </div>
                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl font-medium transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>Cancelar</button>
                  <button type="submit" className="flex-1 h-12 rounded-xl font-bold transition-all" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: 'none' }}>{editMode ? 'Guardar' : 'Criar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categorias;
