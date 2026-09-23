import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addToCart as apiAddToCart,
  ensureCart,
  getCart,
  removeCartItem,
  updateCartItem
} from '@/api/cart';
import { clearCartId, getCartId } from '@/lib/session';
import type { Cart } from '@/types/api';

/**
 * Server-cart state. Nothing is created on mount — the cart is only loaded
 * when an id already exists (or fetched on demand), matching how the legacy
 * pages treated the cart id.
 */

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  /** Load the stored cart (no-op when none exists yet). */
  refresh: () => Promise<Cart | null>;
  /** Guarantee a cart exists server-side (checkout-style flows). */
  ensure: () => Promise<Cart>;
  /** Create-or-load the cart, then add an item (legacy addToCart flow). */
  add: (productIdOrTitle: string, quantity?: number) => Promise<Cart>;
  updateItem: (itemKey: string, quantity: number) => Promise<Cart>;
  removeItem: (itemKey: string) => Promise<Cart>;
  /** Drop the cart locally (after checkout, like legacy clearCartId). */
  clearLocal: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<Cart | null> => {
    const id = getCartId();
    if (!id) return null;
    setLoading(true);
    try {
      const loaded = await getCart(id);
      setCart(loaded);
      return loaded;
    } catch (err) {
      if ((err as { status?: number }).status === 404) {
        clearCartId();
        setCart(null);
        return null;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load an existing cart once on mount.
  useEffect(() => {
    void refresh().catch(() => {
      /* cart loading must never break the page */
    });
  }, [refresh]);

  const add = useCallback(async (productIdOrTitle: string, quantity = 1) => {
    const updated = await apiAddToCart(productIdOrTitle, quantity);
    setCart(updated);
    return updated;
  }, []);

  const updateItem = useCallback(
    async (itemKey: string, quantity: number) => {
      if (!cart) throw new Error('No cart');
      const updated = await updateCartItem(cart.id, itemKey, quantity);
      setCart(updated);
      return updated;
    },
    [cart]
  );

  const removeItem = useCallback(
    async (itemKey: string) => {
      if (!cart) throw new Error('No cart');
      const updated = await removeCartItem(cart.id, itemKey);
      setCart(updated);
      return updated;
    },
    [cart]
  );

  const clearLocal = useCallback(() => {
    clearCartId();
    setCart(null);
  }, []);

  // ensureCart is used by checkout-style flows that must guarantee a cart.
  const ensure = useCallback(async (): Promise<Cart> => {
    const fresh = await ensureCart();
    setCart(fresh);
    return fresh;
  }, []);

  const itemCount = useMemo(
    () => cart?.items.reduce((n, item) => n + item.quantity, 0) ?? 0,
    [cart]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      loading,
      refresh,
      ensure,
      add,
      updateItem,
      removeItem,
      clearLocal
    }),
    [cart, itemCount, loading, refresh, ensure, add, updateItem, removeItem, clearLocal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
