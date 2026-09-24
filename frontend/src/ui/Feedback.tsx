import type { ReactNode } from 'react';

/** Status pill with sensible colours for every status used by the backend. */

const STATUS_COLORS: Record<string, string> = {
  // applications
  pending: 'bg-secondary-container/40 text-on-surface-variant',
  approved: 'bg-primary-container/30 text-primary',
  rejected: 'bg-error-container text-on-error-container',
  // sellers
  active: 'bg-primary-container/30 text-primary',
  blocked: 'bg-error-container text-on-error-container',
  // orders
  paid: 'bg-primary-container/30 text-primary',
  processing: 'bg-secondary-container/40 text-on-surface-variant',
  shipped: 'bg-secondary-container/40 text-on-surface-variant',
  delivered: 'bg-primary-container/30 text-primary',
  cancelled: 'bg-error-container text-on-error-container',
  // returns
  requested: 'bg-secondary-container/40 text-on-surface-variant',
  completed: 'bg-primary-container/30 text-primary'
};

export function StatusPill({
  status,
  colors = STATUS_COLORS
}: {
  status: string;
  colors?: Record<string, string>;
}) {
  const classes =
    colors[status] ?? 'bg-surface-container text-on-surface-variant';
  return (
    <span
      className={`inline-flex items-center px-space-sm py-0.5 rounded-full font-label-sm text-label-sm capitalize whitespace-nowrap ${classes}`}
    >
      {status}
    </span>
  );
}

/** Material-symbols star rating (rounded to the nearest half). */
export function RatingStars({
  rating,
  count,
  className = ''
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  const stars: ReactNode[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const icon = rating >= i - 0.25 ? 'star' : rating >= i - 0.75 ? 'star_half' : 'star_outline';
    stars.push(
      <span key={i} className="material-symbols-outlined text-base text-secondary-fixed-dim">
        {icon}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5`}>
      {stars}
      {count !== undefined ? (
        <span className="font-body-sm text-body-sm text-on-surface-variant ml-space-xs">
          {rating} ({count})
        </span>
      ) : null}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin ${className}`}
    />
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  hint
}: {
  icon?: string;
  title: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-space-sm py-space-xl text-center">
      <span className="material-symbols-outlined text-4xl text-outline">{icon}</span>
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      {hint ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{hint}</p>
      ) : null}
    </div>
  );
}
