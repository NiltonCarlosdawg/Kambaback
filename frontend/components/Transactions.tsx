// src/components/Transactions.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Target } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Gasto, Cartao, Categoria, Objetivo } from '../types';

const Transactions: React.FC = () => {
  const { formatMoney, maskValue, formatDate, prefs } = useTheme();

  const [transacoes,  setTransacoes]  = useState<Gasto[]>([]);
  const [cartoes,     setCartoes]     = useState<Cartao[]>([]);
  const [categorias,  setCategorias]  = useState<Categoria[]>([]);
  const [objetivos,   setObjetivos]   = useState<Objetivo[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [error,       setError]       = useState('');
  const [filter,      setFilter]      = useState<'todos' | 'RECEITA' | 'DESPESA'>('todos');
  const [formData,    setFormData]    = useState({
    descricao: '', valor: '', tipo: 'DESPESA' as 'DESPESA' | 'RECEITA',
    cartaoId: '', categoriaId: '', objetivoId: '',
    data: new Date().toISOString().split('T')[0], local: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const [transRes, cardRes, catRes, objRes] = await Promise.all([
        api.get('/gastos'), api.get('/cartoes'), api.get('/categorias'), api.get('/objetivos'),
      ]);
      setTransacoes(transRes.data.gastos || []);
      setCartoes((cardRes.data.cartoes || []).filter((c: Cartao) => c.ativo && !c.excluido));
      setCategorias(catRes.data.categorias || []);
      setObjetivos(objRes.data.objetivos || []);
    } catch { setError('Falha ao carregar transações.'); }
    finally { setLoading(false); }
  };

  const categoriasFiltradas = useMemo(() => categorias.filter(c =>
    formData.tipo === 'DESPESA'
      ? ['ESSENCIAL', 'FLEXIVEL', 'POUPANCA'].includes(c.tipo)
      : c.tipo === 'RENDIMENTO'
  ), [categorias, formData.tipo]);

  const categoriasAgrupadas = useMemo(() => {
    const g: Record<string, Categoria[]> = {};
    categoriasFiltradas.forEach(c => { (g[c.tipo] = g[c.tipo] || []).push(c); });
    return g;
  }, [categoriasFiltradas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!formData.cartaoId)   { setError('Seleciona uma conta/cartão'); return; }
    if (!formData.categoriaId){ setError('Seleciona uma categoria'); return; }
    try {
      await api.post('/gastos', {
        ...formData, valor: parseFloat(formData.valor), data: new Date(formData.data).toISOString(),
        objetivoId: formData.tipo === 'DESPESA' && formData.objetivoId ? formData.objetivoId : undefined,
      });
      setShowModal(false);
      fetchData();
      setFormData({ descricao: '', valor: '', tipo: 'DESPESA', cartaoId: '', categoriaId: '', objetivoId: '', data: new Date().toISOString().split('T')[0], local: '' });
    } catch (err: any) { setError(err.response?.data?.message || 'Erro ao guardar transação'); }
  };

  const filtered  = transacoes.filter(t => filter === 'todos' || t.tipo === filter);
  const totalRec  = transacoes.filter(t => t.tipo === 'RECEITA').reduce((a, t) => a + Number(t.valor), 0);
  const totalDesp = transacoes.filter(t => t.tipo === 'DESPESA').reduce((a, t) => a + Number(t.valor), 0);
  const saldo     = transacoes.reduce((a, t) => a + (t.tipo === 'RECEITA' ? Number(t.valor) : -Number(t.valor)), 0);

  const tipoNomes: Record<string, string> = { ESSENCIAL: 'Essenciais', FLEXIVEL: 'Flexíveis', POUPANCA: 'Poupança', RENDIMENTO: 'Rendimentos' };

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '12px', color: 'var(--text-primary)', width: '100%', outline: 'none', transition: 'border-color var(--transition-speed,200ms)' };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Transações</h2>
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Gere as tuas receitas e despesas</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
          <Plus size={20} />
          Nova Transação
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="text-red-400" size={20} />
          <p className="text-red-300 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 p-2 rounded-2xl w-fit" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {(['todos', 'RECEITA', 'DESPESA'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              backgroundColor: filter === f ? 'var(--accent)' : 'transparent',
              color:           filter === f ? 'var(--accent-text)' : 'var(--text-muted)',
              boxShadow:       filter === f ? '0 0 15px var(--accent-20)' : 'none',
            }}>
            {f === 'todos' ? 'Todos' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Receitas', val: totalRec,  color: 'var(--accent)'  },
          { label: 'Total Despesas', val: totalDesp, color: '#f87171'         },
          { label: 'Saldo do Período', val: saldo,   color: saldo >= 0 ? 'var(--accent)' : '#f87171' },
        ].map(({ label, val, color }) => (
          <div key={label} style={card}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-2xl font-black mt-2" style={{ color }}>{maskValue(formatMoney(val))}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="overflow-hidden" style={{ ...card, padding: 0 }}>
        {loading ? (
          <p className="p-8 text-center font-medium" style={{ color: 'var(--text-muted)' }}>A carregar…</p>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center" style={{ color: 'var(--text-faint)' }}>Sem transações registadas.</p>
        ) : (
          <div style={{ borderTop: 'none' }}>
            {filtered.map(t => {
              const isReceita = t.tipo === 'RECEITA', valor = Number(t.valor);
              return (
                <div key={t.id}
                  className="p-5 flex items-center justify-between group transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full transition-all"
                      style={{ backgroundColor: isReceita ? 'var(--accent-10)' : 'rgba(239,68,68,0.1)', color: isReceita ? 'var(--accent)' : '#f87171' }}>
                      {isReceita ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{t.descricao || 'Sem descrição'}</p>
                        {t.distribuicaoAutomatica && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/30 bg-blue-500/20 text-blue-300">Auto-distribuído</span>
                        )}
                        {(t as any).objetivo && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 border border-purple-500/30 bg-purple-500/20 text-purple-300">
                            <Target size={10} /> {(t as any).objetivo.titulo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1 flex-wrap" style={{ color: 'var(--text-faint)' }}>
                        <span>{formatDate(t.data)}</span>
                        <span>•</span>
                        <span>{(t as any).cartao?.nome || 'Conta removida'}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                          {t.categoria?.nome || 'Geral'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-lg" style={{ color: isReceita ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {isReceita ? '+' : '-'} {maskValue(formatMoney(valor))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
            <h3 className="text-xl font-black mb-6" style={{ color: 'var(--text-primary)' }}>Registar Movimento</h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm font-medium border border-red-500/20 bg-red-500/10 text-red-300">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-4">
                {(['DESPESA', 'RECEITA'] as const).map(tipo => {
                  const active = formData.tipo === tipo;
                  const isRec = tipo === 'RECEITA';
                  return (
                    <button key={tipo} type="button"
                      onClick={() => setFormData({ ...formData, tipo, objetivoId: '', categoriaId: '' })}
                      className="p-4 rounded-xl text-center transition-all"
                      style={{
                        border:          active ? `1px solid ${isRec ? 'var(--accent)' : 'rgba(239,68,68,0.5)'}` : '1px solid var(--border)',
                        backgroundColor: active ? (isRec ? 'var(--accent-10)' : 'rgba(239,68,68,0.15)') : 'transparent',
                        color:           active ? (isRec ? 'var(--accent)' : '#f87171') : 'var(--text-faint)',
                        fontWeight:      active ? 700 : 400,
                        boxShadow:       active ? `0 0 15px ${isRec ? 'var(--accent-20)' : 'rgba(239,68,68,0.15)'}` : 'none',
                      }}>
                      {isRec ? <ArrowUpCircle className="mx-auto mb-2" size={24} /> : <ArrowDownCircle className="mx-auto mb-2" size={24} />}
                      <span className="text-sm">{isRec ? 'Receita' : 'Despesa'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Valor */}
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>Valor (Kz) *</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00"
                  value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
                  onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'var(--border-strong)'; }}
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>Descrição *</label>
                <input type="text" required placeholder="Ex: Compra de supermercado"
                  value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
                  onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'var(--border-strong)'; }}
                />
              </div>

              {/* Categoria + Data */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>Categoria *</label>
                  <select required value={formData.categoriaId}
                    onChange={e => setFormData({ ...formData, categoriaId: e.target.value })}
                    style={{ ...inputStyle, background: 'var(--bg-elevated)' }}>
                    <option value="">Selecionar…</option>
                    {Object.keys(categoriasAgrupadas).map(tipo => (
                      <optgroup key={tipo} label={tipoNomes[tipo]}>
                        {categoriasAgrupadas[tipo].map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>Data *</label>
                  <input type="date" required value={formData.data}
                    onChange={e => setFormData({ ...formData, data: e.target.value })}
                    style={{ ...inputStyle, background: 'var(--bg-elevated)' }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
                    onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = 'var(--border-strong)'; }}
                  />
                </div>
              </div>

              {/* Objetivo (despesa) */}
              {formData.tipo === 'DESPESA' && (
                <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
                  <label className="text-sm font-bold flex items-center gap-2 mb-2 text-purple-300">
                    <Target size={16} /> Guardar neste Objetivo (Opcional)
                  </label>
                  <select value={formData.objetivoId}
                    onChange={e => setFormData({ ...formData, objetivoId: e.target.value })}
                    style={{ ...inputStyle, background: 'var(--bg-elevated)', borderColor: 'rgba(168,85,247,0.3)' }}>
                    <option value="">Nenhum (despesa normal)</option>
                    {objetivos.map(o => (
                      <option key={o.id} value={o.id}>{o.titulo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cartão */}
              <div>
                <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>Conta / Cartão *</label>
                <select required value={formData.cartaoId}
                  onChange={e => setFormData({ ...formData, cartaoId: e.target.value })}
                  style={{ ...inputStyle, background: 'var(--bg-elevated)' }}>
                  <option value="">Selecionar…</option>
                  {cartoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} (Disp: {formatMoney(Number((c as any).saldoDisponivel || c.saldoAtual))})</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold transition-all"
                  style={{ border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', boxShadow: '0 0 20px var(--accent-20)' }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;