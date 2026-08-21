const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-12 w-12 text-base',
  '2xl': 'h-16 w-16 text-2xl',
  '3xl': 'h-24 w-24 text-3xl',
};

export function Avatar({ src, name = '', size = 'md', className = '', alt = '' }) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const box = `${SIZES[size] || SIZES.md} shrink-0 overflow-hidden rounded-full ${className}`;

  if (src) {
    return (
      <img src={src} alt={alt || name} className={`${box} object-cover`} />
    );
  }

  return (
    <span className={`font-label flex items-center justify-center bg-surface-container text-primary ${box}`}>
      {initial}
    </span>
  );
}
