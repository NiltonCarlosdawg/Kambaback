import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { springBouncy, springSmooth } from './ui/animations/variants';

interface ResetPasswordProps {
  email: string;
  onBackToLogin: () => void;
  onResetSuccess: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ email, onBackToLogin, onResetSuccess }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    data.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    const nextIndex = Math.min(data.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Insere o código OTP de 6 dígitos.');
      return;
    }
    if (novaSenha.length < 8) {
      setError('Nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(novaSenha)) {
      setError('Senha deve conter letras maiúsculas, minúsculas e números.');
      return;
    }
    if (novaSenha !== confirmSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/redefinir-senha', { email, otp: otpCode, novaSenha });
      setSuccess(true);
      setTimeout(onResetSuccess, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao redefinir senha. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Senha redefinida!</h2>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            A tua palavra-passe foi alterada com sucesso.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>A redirecionar para o login…</p>
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Redefinir palavra-passe</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Insere o código OTP enviado para <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> e escolhe uma nova senha.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm border" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--text-faint)' }}>
              Código OTP
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 rounded-xl text-center text-xl font-bold outline-none border transition-all"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    borderColor: digit ? 'var(--accent)' : 'var(--border)',
                    color: 'var(--text-primary)',
                    boxShadow: digit ? '0 0 0 1px var(--accent)' : 'none',
                  }}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
              Nova palavra-passe
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-12 pr-12 rounded-xl outline-none border transition-all"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-faint)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
              Confirmar nova palavra-passe
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmSenha}
                onChange={e => setConfirmSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-12 pr-12 rounded-xl outline-none border transition-all"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading || otp.join('').length !== 6 || !novaSenha || !confirmSenha}
            className="relative w-full h-[52px] rounded-xl font-semibold text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <motion.div className="w-5 h-5 rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent-text)', borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  A redefinir…
                </>
              ) : (
                'Redefinir palavra-passe'
              )}
            </span>
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
