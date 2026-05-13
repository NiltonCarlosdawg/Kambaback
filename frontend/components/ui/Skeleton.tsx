import React from 'react';

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-xl border animate-pulse ${className}`} style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
      <div className="h-8 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    </div>
  </div>
);

export const SkeletonRow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-3 p-4 animate-pulse ${className}`}>
    <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    </div>
    <div className="h-5 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
  </div>
);

export const SkeletonChart: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-xl border p-4 animate-pulse ${className}`} style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
    <div className="h-4 w-32 rounded mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
    <div className="h-48 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }} />
  </div>
);
