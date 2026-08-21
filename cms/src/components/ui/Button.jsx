const VARIANTS = {
  primary: 'bg-primary text-on-primary border-t border-white/20 shadow-sm hover:scale-[1.02]',
  secondary: 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary hover:text-primary',
  tonal: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  success: 'bg-tertiary text-on-tertiary hover:scale-[1.02]',
  danger: 'bg-error text-on-error hover:scale-[1.02]',
  ghost: 'text-on-surface-variant hover:text-primary',
  white: 'bg-surface text-primary shadow-lg hover:scale-[1.02]',
};

const SIZES = {
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-10 py-4 text-base',
};

export function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <Tag
      className={`font-label inline-flex items-center justify-center gap-2 rounded-full transition-transform duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      {...props}
    >
      {loading ? 'Memproses...' : children}
    </Tag>
  );
}
