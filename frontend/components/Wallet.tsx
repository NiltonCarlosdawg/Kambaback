// src/components/Wallet.tsx
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CreditCard, Plus, Save, ShieldCheck, X, RefreshCcw, Loader2, Trash2, Settings2, DollarSign, Wallet as WalletIcon, Lock, PiggyBank } from 'lucide-react';
import cardsService from '../services/cardsService';
import { Cartao } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { springBouncy, springSmooth } from './ui/animations/variants';

// ─── Sub-components ──────────────────────────────────────────────────────────

const CardVisual: React.FC<{ card: Cartao; index: number; onEdit: (c: Cartao) => void }> = ({ card, index, onEdit }) => {
  const { maskValue, formatMoney } = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springBouncy, delay: index * 0.1 }}
      whileHover={{ y: -5, transition: springSmooth }}
      className="relative group h-48 rounded-2xl p-6 overflow-hidden flex flex-col justify-between shadow-xl cursor-pointer"
      style={{ 
        background: `linear-gradient(135deg, ${card.cor || 'var(--accent)'}, ${card.cor ? card.cor + 'dd' : 'var(--accent-dark)'})`,
        color: '#fff'
      }}
      onClick={() => onEdit(card)}
    >
      <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Banco / Entidade</p>
          <h3 className="text-lg font-bold">{card.nome}</h3>
        </div>
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
          <CreditCard size={20} />
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Saldo Actual</p>
        <p className="text-2xl font-black">{maskValue(formatMoney(Number(card.saldoAtual)))}</p>
      </div>

      <div className="flex justify-between items-end relative z-10">
        <div className="flex gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase opacity-50">Disponível</p>
            <p className="text-xs font-bold">{maskValue(formatMoney(Number(card.saldoDisponivel)))}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {card.distribuirParaObjetivos && Number(card.percentualDistribuicaoPoupanca) > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/30 backdrop-blur-md border border-white/10">
              <PiggyBank size={10} />
              <span className="text-[8px] font-bold">{card.percentualDistribuicaoPoupanca}%</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-md border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${card.ativo ? 'bg-emerald-400' : 'bg-white/20'}`} />
            <span className="text-[9px] font-bold uppercase">{card.tipo}</span>
          </div>
        </div>
      </div>
      
      {/* Settings hover overlay */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
        <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl border border-white/20 shadow-2xl">
          <Settings2 size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Gerir Conta</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Wallet: React.FC = () => {
  const { maskValue, formatMoney } = useTheme();
  const [cards,      setCards]      = useState<Cartao[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [selected,   setSelected]   = useState<Cartao | null>(null);
  const [error,      setError]      = useState('');
  
  const [formData, setFormData] = useState({
    nome: '', tipo: 'DEBITO', saldoAtual: '', cor: '#3b82f6', ativo: true,
    distribuirParaObjetivos: false, percentualDistribuicaoPoupanca: '0',
  });

  const autoDistribActive = formData.distribuirParaObjetivos && Number(formData.percentualDistribuicaoPoupanca) > 0;

  const fetchCards = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await cardsService.listar();
      setCards(res.cartoes || []);
    } catch { setError('Falha ao carregar carteira.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchCards(); }, []);

  const handleOpenCreate = () => {
    setSelected(null);
    setFormData({ nome: '', tipo: 'DEBITO', saldoAtual: '', cor: '#3b82f6', ativo: true, distribuirParaObjetivos: false, percentualDistribuicaoPoupanca: '0' });
    setShowModal(true);
  };

  const handleOpenEdit = (c: Cartao) => {
    setSelected(c);
    setFormData({ 
      nome: c.nome, 
      tipo: c.tipo, 
      saldoAtual: c.saldoAtual.toString(), 
      cor: c.cor || '#3b82f6',
      ativo: c.ativo,
      distribuirParaObjetivos: c.distribuirParaObjetivos || false,
      percentualDistribuicaoPoupanca: (c.percentualDistribuicaoPoupanca || 0).toString(),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const payload: Record<string, any> = {
        nome: formData.nome,
        tipo: formData.tipo,
        cor: formData.cor,
        ativo: formData.ativo,
        distribuirParaObjetivos: formData.distribuirParaObjetivos,
        percentualDistribuicaoPoupanca: Number(formData.percentualDistribuicaoPoupanca),
      };
      if (selected) {
        await cardsService.atualizar(selected.id, payload);
      } else {
        payload.saldoAtual = Number(formData.saldoAtual);
        await cardsService.criar(payload);
      }
      setShowModal(false);
      fetchCards(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao guardar dados.');
    }
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`Eliminar a conta "${selected.nome}"? Esta acção não pode ser desfeita.`)) return;
    try {
      await cardsService.remover(selected.id);
      setShowModal(false);
      fetchCards(true);
    } catch { alert('Erro ao eliminar conta.'); }
  };

  if (loading) return (
    <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-faint)' }}>Organizando os teus cartões…</p>
    </div>
  );

  const stats = [
    { label: 'Total na Carteira', value: maskValue(formatMoney(cards.reduce((a, c) => a + Number(c.saldoAtual), 0))), icon: DollarSign, color: 'var(--accent)' },
    { label: 'Contas Activas', value: cards.filter(c => c.ativo).length.toString(), icon: ShieldCheck, color: '#10b981' },
    { label: 'Cartões de Crédito', value: cards.filter(c => c.tipo === 'CREDITO').length.toString(), icon: CreditCard, color: '#f59e0b' },
  ];

  return (
    <motion.div className="max-w-5xl mx-auto space-y-8 pb-20"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <WalletIcon size={32} style={{ color: 'var(--accent)' }} />
            A Minha Carteira
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Gere as tuas contas bancárias, cartões e dinheiro físico.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => fetchCards(true)} disabled={refreshing}
            className="p-2.5 rounded-xl border transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleOpenCreate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-accent/20"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
            <Plus size={18} />
            Nova Conta
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={14} style={{ color: stat.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{stat.label}</span>
            </div>
            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 py-20 text-center border-2 border-dashed rounded-3xl" style={{ borderColor: 'var(--border)' }}>
            <CreditCard size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Nenhuma conta registada</h3>
            <p className="text-sm mt-1 mb-6" style={{ color: 'var(--text-faint)' }}>Começa por adicionar a tua conta principal ou carteira física.</p>
            <button onClick={handleOpenCreate} className="px-6 py-2 rounded-xl font-bold" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
              + Adicionar primeira conta
            </button>
          </div>
        ) : (
          cards.map((c, i) => <CardVisual key={c.id} card={c} index={i} onEdit={handleOpenEdit} />)
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            
            <motion.div
              layoutId="wallet-form"
              className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl border"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {selected ? 'Editar Conta' : 'Nova Conta'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-faint)' }}>
                  <X size={20} />
                </button>
              </div>

              <motion.form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Nome da Conta / Banco</label>
                  <input 
                    type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Banco BAI, Carteira, PayPal…"
                    className="w-full px-4 py-3 rounded-xl outline-none border transition-all"
                    style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Tipo</label>
                    <select 
                      disabled={!!selected}
                      value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none border appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="DEBITO">Débito / Corrente</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="POUPANCA">Poupança</option>
                      <option value="DINHEIRO">Dinheiro Vivo</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Saldo Inicial (Kz)</label>
                    <input 
                      type="number" 
                      required 
                      disabled={!!selected}
                      value={formData.saldoAtual} onChange={e => setFormData({...formData, saldoAtual: e.target.value})}
                      placeholder="0,00"
                      className="w-full px-4 py-3 rounded-xl outline-none border transition-all font-mono font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {selected && (
                  <p className="text-[10px] italic px-1" style={{ color: 'var(--text-faint)' }}>
                    * Para alterar o saldo ou tipo, utiliza as transacções ou cria uma nova conta.
                  </p>
                )}

                {/* Auto-distribuição */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: autoDistribActive ? 'rgba(16,185,129,0.08)' : 'var(--bg-base)', border: `1px solid ${autoDistribActive ? 'rgba(16,185,129,0.3)' : 'var(--border)'}` }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: autoDistribActive ? '#34d399' : 'var(--text-faint)' }}>
                      <PiggyBank size={14} />
                      Distribuição Automática
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, distribuirParaObjetivos: !formData.distribuirParaObjetivos, percentualDistribuicaoPoupanca: formData.distribuirParaObjetivos ? '0' : formData.percentualDistribuicaoPoupanca })}
                      className={`relative w-12 h-6 rounded-full transition-all ${formData.distribuirParaObjetivos ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${formData.distribuirParaObjetivos ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  {formData.distribuirParaObjetivos && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                        Percentagem de cada receita (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentualDistribuicaoPoupanca}
                        onChange={e => setFormData({ ...formData, percentualDistribuicaoPoupanca: e.target.value })}
                        placeholder="Ex: 20"
                        className="w-full px-4 py-3 rounded-xl outline-none border transition-all font-mono font-bold"
                        style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        Quando registares uma receita, {formData.percentualDistribuicaoPoupanca || 0}% será distribuído pelos objectivos que tiverem percentagem de distribuição definida.
                      </p>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Cor do Cartão</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})}
                      className="w-12 h-12 rounded-lg border-none cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono opacity-40">{formData.cor.toUpperCase()}</span>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  {selected && (
                    <button type="button" onClick={handleDelete}
                      className="p-3 rounded-xl font-bold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl font-bold border transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
                    Cancelar
                  </button>
                  <motion.button type="submit"
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-[2] py-3 rounded-xl font-black shadow-lg shadow-accent/20"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                    {selected ? 'Guardar Alterações' : 'Criar Conta'}
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Wallet;
