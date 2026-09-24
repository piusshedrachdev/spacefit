import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '@/api/notifications';
import { useAuth } from '@/context/AuthProvider';
import type { AppNotification } from '@/types/api';

/**
 * Notification bell state — loads the same `getNotifications(20)` the legacy
 * chrome.js fired, and re-fetches whenever auth state changes.
 */

interface NotificationsContextValue {
  items: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const page = await getNotifications(20);
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch {
      // Never let the bell break the page (legacy chrome behaviour).
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await markNotificationRead(id);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
    } finally {
      await refresh();
    }
  }, [refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unreadCount, refresh, markRead, markAllRead }),
    [items, unreadCount, refresh, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
