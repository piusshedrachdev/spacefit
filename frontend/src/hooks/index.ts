import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { useCart } from '@/context/CartProvider';
import { useToast } from '@/context/ToastProvider';

/**
 * Shared data + action hooks so pages don't re-implement loading/error logic.
 */

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: DependencyList = []
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reload]);

  return { data, loading, error, reload, setData };
}

export interface AddToCartOptions {
  quantity?: number;
  size?: string;
  color?: string;
  /** Toast label; falls back to the product id/title passed in. */
  label?: string;
}

/**
 * Shared add-to-cart action: hits the API through CartProvider, bumps the
 * header badge, and raises the shared toast — one implementation for the
 * product cards, the PDP and any future surface.
 */
export function useAddToCart(): {
  addToCart: (productIdOrTitle: string, options?: AddToCartOptions) => Promise<boolean>;
  pending: boolean;
} {
  const { add } = useCart();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const addToCart = useCallback(
    async (productIdOrTitle: string, options: AddToCartOptions = {}) => {
      setPending(true);
      try {
        await add(productIdOrTitle, options.quantity ?? 1, options.size, options.color);
        toast(`${options.label ?? productIdOrTitle} added`);
        return true;
      } catch (err) {
        toast(`Could not add to cart: ${(err as Error).message}`, true);
        return false;
      } finally {
        setPending(false);
      }
    },
    [add, toast]
  );

  return { addToCart, pending };
}
