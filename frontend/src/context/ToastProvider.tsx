import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Toast host — generic messages use the legacy top-right stack, while cart
 * confirmations use the reference shop's bottom-centre feedback style.
 */

export type ToastKind = 'default' | 'cart';

export interface ToastItem {
  id: number;
  message: string;
  isError: boolean;
  kind: ToastKind;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, isError?: boolean) => void;
  toastCart: (itemTitle: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_TTL_MS = 3200;
const CART_TOAST_TTL_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, isError = false) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, isError, kind: 'default' }]);
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS);
    },
    [dismiss]
  );

  const toastCart = useCallback(
    (itemTitle: string) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.filter((item) => item.kind !== 'cart'),
        { id, message: itemTitle, isError: false, kind: 'cart' }
      ]);
      window.setTimeout(() => dismiss(id), CART_TOAST_TTL_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, toastCart, dismiss }),
    [toasts, toast, toastCart, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
