import { useState } from 'react';
import type { ReactNode } from 'react';

/** Underline tabs used by the seller/admin dashboards and the auth page. */

export interface TabItem {
  id: string;
  label: ReactNode;
}

export function Tabs({
  items,
  activeId,
  onChange,
  className = ''
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-space-lg border-b border-outline-variant/40 overflow-x-auto ${className}`}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              'relative py-space-sm font-label-lg text-label-lg whitespace-nowrap transition-colors',
              active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            ].join(' ')}
          >
            {item.label}
            <span
              className={[
                'absolute bottom-0 left-0 h-0.5 bg-primary transition-all',
                active ? 'w-full' : 'w-0'
              ].join(' ')}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Dropdown that closes on outside click (used by the account menu). */
export function useMenuOpen(): [boolean, () => void, (open?: boolean) => void] {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((current) => !current);
  return [open, toggle, (next?: boolean) => setOpen(next ?? !open)];
}
