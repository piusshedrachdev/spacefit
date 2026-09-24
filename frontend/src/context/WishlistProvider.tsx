import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { addWishlistItem, getWishlist, removeWishlistItem } from '@/api/wishlist';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import type { Product } from '@/types/api';

/**
 * Server-backed wishlist state (per account, `/api/wishlist`). Loads whenever
 * auth state changes (same contract as NotificationsProvider); hearts on
 * product cards and the PDP read `has()` and call `toggle()`.
 */

interface WishlistContextValue {
  /** Saved products, newest first. */
  items: Product[];
  /** True while the initial auth-scoped fetch is in flight. */
  loading: boolean;
  has: (productId: string) => boolean;
  /** Save/unsave a product; resolves to the resulting saved state. */
  toggle: (productId: string) => Promise<boolean>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await getWishlist());
    } catch {
      // Never let the wishlist break the page (the bell behaves the same).
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!isAuthenticated) {
        toast('Sign in to save items to your wishlist.', true);
        return false;
      }
      const saved = items.some((item) => item.id === productId);
      try {
        if (saved) {
          await removeWishlistItem(productId);
          setItems((current) => current.filter((item) => item.id !== productId));
          return false;
        }
        const product = await addWishlistItem(productId);
        setItems((current) =>
          current.some((item) => item.id === product.id) ? current : [product, ...current]
        );
        return true;
      } catch (err) {
        toast(`Could not update your wishlist: ${(err as Error).message}`, true);
        return saved;
      }
    },
    [isAuthenticated, items, toast]
  );

  const has = useCallback(
    (productId: string) => items.some((item) => item.id === productId),
    [items]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({ items, loading, has, toggle }),
    [items, loading, has, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
