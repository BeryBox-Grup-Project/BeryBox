import { CaretDown } from '@phosphor-icons/react';

export function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-2">
      {label && <span className="font-label text-sm text-on-surface">{label}</span>}
      {children}
      {hint && !error && <span className="text-xs text-on-surface-variant">{hint}</span>}
      {error && <span className="text-xs text-error">{error}</span>}
    </label>
  );
}

const base = 'w-full bg-background border border-outline-variant px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline';

export function Input({ className = '', ...props }) {
  return <input className={`${base} rounded-full ${className}`} {...props} />;
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={`${base} resize-none rounded-2xl ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <div className="relative">
      <select className={`${base} appearance-none rounded-full pr-10 ${className}`} {...props}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <CaretDown size={14} weight="bold" />
      </span>
    </div>
  );
}
