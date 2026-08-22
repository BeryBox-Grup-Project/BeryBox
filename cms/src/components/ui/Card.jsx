export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`soft-shadow rounded-3xl border border-surface-variant bg-surface-container-lowest ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Chip({ active = false, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`font-label shrink-0 rounded-full px-5 py-2 text-sm transition-colors ${
        active
          ? 'border-t border-white/20 bg-primary text-on-primary shadow-sm'
          : 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:text-primary'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', className = '', children }) {
  const tones = {
    neutral: 'bg-surface-container text-on-surface',
    primary: 'bg-surface-container text-primary',
    success: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    warning: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    danger: 'bg-error-container text-on-error-container',
  };
  return (
    <span className={`font-label inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
