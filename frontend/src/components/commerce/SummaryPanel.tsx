import type { ReactNode } from 'react';

/**
 * Shared order-summary pieces used by the cart sidebar and the checkout
 * column (legacy cart.html / checkout.html summary markup).
 */

/** Default card shell (cart). Callers may pass their own (checkout). */
export const SUMMARY_PANEL_BASE =
  'bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6';

export function SummaryPanel({
  title,
  className = SUMMARY_PANEL_BASE,
  children
}: {
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {title ? (
        <h2 className="font-headline-md text-headline-md text-on-surface mb-6">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

export function SummaryRow({
  label,
  value,
  className = 'mb-4',
  labelClassName = 'font-body-md text-body-md text-on-surface-variant',
  valueClassName = 'font-semibold'
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className={labelClassName}>{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

export function SummaryDivider({ className = 'my-5' }: { className?: string }) {
  return <div className={`border-t border-outline-variant/40 ${className}`} />;
}

export function SummaryTotal({
  label = 'Total',
  value,
  className = 'mb-6'
}: {
  label?: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className="font-price-lg text-price-lg">{label}</span>
      <span className="font-price-lg text-price-lg text-primary">{value}</span>
    </div>
  );
}
