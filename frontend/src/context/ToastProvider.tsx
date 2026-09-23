import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Toast host — the React equivalent of the legacy chrome.js `toast()`
 * (3.2s auto-dismiss, error variant, top-right stack).
 */

export interface ToastItem {
  id: number;
  message: string;
  isError: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, isError?: boolean) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_TTL_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, isError = false) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, isError }]);
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
