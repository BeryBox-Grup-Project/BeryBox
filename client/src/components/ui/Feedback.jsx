import { Archive, Star, Warning } from '@phosphor-icons/react';
import { Card } from './Card';

export function ModeratorNotice({ message, className = '' }) {
  return (
    <span className={`flex items-start gap-2 rounded-xl border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container ${className}`}>
      <Warning size={20} weight="fill" className="mt-0.5 shrink-0 text-error" aria-hidden />
      <span>{message}</span>
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-container ${className}`} />;
}

export function CardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-3">
      <Skeleton className="mb-3 aspect-[4/3] w-full" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-4 h-3 w-1/2" />
      <Skeleton className="mt-auto h-8 w-full" />
    </Card>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-primary">
        <Archive size={28} weight="duotone" />
      </div>
      <h3 className="font-headline text-lg text-on-surface">{title}</h3>
      {description && <p className="max-w-sm text-sm text-on-surface-variant">{description}</p>}
      {action}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-stack-lg flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="font-label text-xs uppercase tracking-wide text-primary">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-3xl font-extrabold leading-tight text-on-surface md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function starSize(size) {
  if (typeof size === 'number') return size;
  if (size === 'text-base') return 16;
  return 20;
}

export function Stars({ value = 0, onChange, readOnly = false, size = 'text-xl' }) {
  const px = starSize(size);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={`${filled ? 'text-secondary-container' : 'text-outline-variant'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            aria-label={`${star} bintang`}
          >
            <Star size={px} weight={filled ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}
