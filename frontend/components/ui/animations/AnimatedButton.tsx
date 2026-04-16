import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { springPress } from './variants';

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'relative font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]';

  const variantStyles = {
    primary: 'bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-110 focus:ring-[var(--accent)] active:brightness-90',
    secondary: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-surface)] focus:ring-[var(--border-strong)] active:brightness-90',
    ghost: 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] focus:ring-[var(--border)]',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500 active:brightness-90',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2.5 min-h-[40px]',
    lg: 'text-base px-6 py-3 min-h-[48px]',
  };

  return (
    <motion.button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.03 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      transition={springPress}
      {...props}
    >
      {loading ? (
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </motion.span>
      ) : null}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </motion.button>
  );
};

export default AnimatedButton;
