import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'error';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary hover:bg-primary-container text-on-primary disabled:bg-outline-variant disabled:text-outline',
  outline:
    'border border-outline-variant text-on-surface hover:border-primary hover:text-primary',
  ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  error: 'bg-error text-on-error hover:opacity-90'
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Stretch to the container width (mobile forms). */
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-space-xs rounded-lg px-space-lg py-space-sm',
        'font-label-md text-label-md transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        block ? 'w-full' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
