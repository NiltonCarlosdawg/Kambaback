import React from 'react';
import { motion } from 'framer-motion';
import { springSmooth } from './variants';

interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  delay?: number;
  color?: string;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  max = 100,
  className = '',
  barClassName = '',
  showLabel = true,
  delay = 0,
  color,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--text-muted)]">Progresso</span>
          <motion.span
            className="font-semibold text-[var(--text-primary)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.3 }}
          >
            {percentage.toFixed(0)}%
          </motion.span>
        </div>
      )}
      
      <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barClassName}`}
          style={{ 
            backgroundColor: color || 'var(--accent)',
            width: '100%' 
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            ...springSmooth,
            delay,
            type: 'spring',
            stiffness: 100,
            damping: 20,
          }}
        />
      </div>
    </div>
  );
};

interface AnimatedCountUpProps {
  value: number;
  duration?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCountUp: React.FC<AnimatedCountUpProps> = ({
  value,
  duration = 1.5,
  separator = ',',
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeOut * value);
      
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  const formatted = displayValue.toLocaleString('pt-AO').replace(/,/g, separator);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
};

export default AnimatedProgress;
