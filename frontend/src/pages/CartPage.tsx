import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ProductImage,
  QuantityStepper,
  SUMMARY_PANEL_BASE,
  SummaryDivider,
  SummaryPanel,
  SummaryRow,
  SummaryTotal
} from '@/components/commerce';
import { useCart } from '@/context/CartProvider';
import { useSettings } from '@/context/SettingsProvider';
import { useToast } from '@/context/ToastProvider';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Spinner } from '@/ui';
import type { CartItem } from '@/types/api';

/** Cart — port of legacy cart.html + js/cart.js (ensureCart on mount). */
export function CartPage() {
  const { cart, ensure, updateItem, removeItem } = useCart();
  const { toast } = useToast();
  const { config } = useSettings();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  const symbol = config?.currencySymbol;
  const money = (amount?: number | null) => formatPrice(amount, symbol);

  // Legacy cart.js called ensureCart() during init.
  useEffect(() => {
    void ensure()
      .catch(() => {
        toast('Could not load your cart.', true);
      })
      .finally(() => setReady(true));
  }, [ensure, toast]);

  const remove = (item: CartItem) => {
    removeItem(item.key).catch((err) =>
      toast(`Could not remove item: ${(err as Error).message}`, true)
    );
  };

  const changeQuantity = (item: CartItem, delta: number) => {
    const next = item.quantity + delta;
    if (next <= 0) {
      remove(item);
      return;
    }
    updateItem(item.key, next).catch((err) =>
      toast(`Could not update quantity: ${(err as Error).message}`, true)
    );
  };

  const proceed = () => {
    if (!cart || cart.items.length === 0) {
      toast('Your cart is empty.', true);
      return;
    }
    navigate(routes.checkout);
  };

  const items = cart?.items ?? [];
  const empty = ready && items.length === 0;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-12">
      <div className="mb-10">
        <p className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-[0.2em] mb-3">
          Your Selection
        </p>
        <h1 className="font-headline-lg text-headline-lg md:text-[40px] md:leading-[48px] text-on-surface tracking-tight">
          Shopping Cart
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-3 max-w-xl">
          Review the furniture and pieces you&apos;ve selected for your space.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-4">
          {!ready ? (
            <div className="flex justify-center py-space-xl">
              <Spinner />
            </div>
          ) : null}

          {items.map((item) => (
            <div
              key={item.key}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 md:p-5"
            >
              <div className="flex gap-4">
                <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    fallbackClassName="text-4xl"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        {item.name}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {item.size || ''}
                        {item.color ? ` \u2022 ${item.color}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-outline hover:text-error transition-colors"
                      title="Remove"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => remove(item)}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <QuantityStepper
                      quantity={item.quantity}
                      onDecrease={() => changeQuantity(item, -1)}
                      onIncrease={() => changeQuantity(item, 1)}
                    />
                    <span className="font-price-md text-price-md text-on-surface font-bold">
                      {money(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {empty ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-10 md:p-16 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-low flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-outline">
                  shopping_bag
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
                Your cart is empty
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto mb-7">
                You haven&apos;t added anything to your space yet. Explore our collection and find
                something that fits.
              </p>
              <Link
                to={routes.home}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg font-semibold transition"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Continue Shopping
              </Link>
            </div>
          ) : null}
        </section>

        <aside>
          <SummaryPanel title="Order Summary" className={`${SUMMARY_PANEL_BASE} sticky top-28`}>
            <SummaryRow label="Subtotal" value={money(cart?.subtotal ?? 0)} />
            <SummaryRow
              label="Delivery"
              value="Calculated later"
              valueClassName="font-body-md text-body-md font-medium"
            />
            <SummaryDivider />
            <SummaryTotal label="Total" value={money(cart?.total ?? 0)} />
            <button
              type="button"
              onClick={proceed}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
            >
              Proceed to Checkout
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <Link
              to={routes.home}
              className="mt-5 flex items-center justify-center gap-2 text-primary font-label-md text-label-md font-semibold hover:underline"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Continue Shopping
            </Link>
          </SummaryPanel>
        </aside>
      </div>
    </div>
  );
}
