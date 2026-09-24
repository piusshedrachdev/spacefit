import { useEffect, type ReactNode } from 'react';

/** Surface card + titled section shell used across storefront and dashboards. */

export function Card({
  className = '',
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  className = '',
  children
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`p-space-lg ${className}`}>
      {title || action ? (
        <div className="flex items-center justify-between gap-space-md pb-space-md">
          {title ? (
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Optional action row (Cancel/Confirm) — the legacy modal() footer. */
  footer?: ReactNode;
}) {
  // Escape to close, like the legacy modal helpers.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-margin-mobile bg-inverse-surface/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-space-md px-space-lg py-space-md border-b border-outline-variant/40">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-space-xs rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="p-space-lg">{children}</div>
        {footer ? (
          <div className="px-space-lg py-space-md border-t border-outline-variant/40 flex justify-end gap-space-sm">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
