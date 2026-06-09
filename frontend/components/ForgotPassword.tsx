import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { springBouncy, springSmooth } from './ui/animations/variants';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
  onOtpSent: (email: string) => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin, onOtpSent }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/esqueci-senha', { email });
      setSent(true);
      setTimeout(() => onOtpSent(email), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao enviar código. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springBouncy}
        >
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--accent)' }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <svg fill="black" viewBox="0 0 48 48" className="w-8 h-8"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" /></svg>
          </motion.div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Email enviado!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Se o email <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> estiver registado, receberás um código OTP.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>A redirecionar…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSmooth}
      >
        <motion.button
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-sm mb-8"
          style={{ color: 'var(--text-faint)' }}
          whileHover={{ color: 'var(--accent)', x: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={16} />
          Voltar ao login
        </motion.button>

        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--accent-10)' }}>
            <ShieldCheck size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Esqueceu a palavra-passe?</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Insere o teu email e enviaremos um código OTP para redefinir a tua senha.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm border" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
              Endereço de email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full h-12 pl-12 pr-4 rounded-xl outline-none border transition-all"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading || !email}
            className="relative w-full h-[52px] rounded-xl font-semibold text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <motion.div className="w-5 h-5 rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent-text)', borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  A enviar…
                </>
              ) : (
                <>
                  Enviar código OTP
                  <ArrowRight size={18} />
                </>
              )}
            </span>
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
