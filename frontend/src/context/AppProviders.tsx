import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthProvider';
import { CartProvider } from '@/context/CartProvider';
import { NotificationsProvider } from '@/context/NotificationsProvider';
import { SettingsProvider } from '@/context/SettingsProvider';
import { ToastProvider } from '@/context/ToastProvider';

/**
 * Provider stack for the whole app. Order matters:
 * Notifications reads Auth; everything may push toasts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <NotificationsProvider>
            <CartProvider>{children}</CartProvider>
          </NotificationsProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
