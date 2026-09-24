import { Link, useParams } from 'react-router-dom';
import { getOrder } from '@/api/orders';
import { ProductImage } from '@/components/commerce';
import { useSettings } from '@/context/SettingsProvider';
import { useAsync } from '@/hooks';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * Order confirmation — port of legacy order-succes.html (typo preserved in
 * inbound links; see src/appRoutes.tsx redirects) + js/order-success.js.
 * Without an id the static default confirmation is kept, like legacy.
 */
export function OrderSuccessPage() {
  const { id } = useParams();
  const { data: order } = useAsync(() => (id ? getOrder(id) : Promise.resolve(null)), [id]);

  const { config } = useSettings();
  const symbol = config?.currencySymbol;
  const money = (amount?: number | null) => formatPrice(amount, symbol);

  const reference = order ? `#${order.reference || order.id}` : '#SF123456';
  const total = money(order?.total ?? 780000);
  const items = order?.items ?? [];

  return (
    <div className="max-w-4xl mx-auto w-full px-4 pt-8 pb-16 flex flex-col items-center">
      {/* Success badge */}
      <div className="w-16 h-16 rounded-full bg-primary-fixed border-4 border-primary-fixed-dim flex items-center justify-center mb-5 shadow-sm">
        <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white stroke-[2.5]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight text-center">
        Order placed successfully!
      </h1>
      <p className="text-on-surface-variant text-sm sm:text-base text-center mt-2 max-w-md leading-relaxed">
        Thank you for shopping with SpaceFit. Your order has been confirmed and is being
        processed.
      </p>

      {/* Order details card */}
      <div className="mt-8 w-full max-w-lg bg-surface-container-low border border-outline-variant rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
          <div>
            <span className="text-xs font-semibold text-on-surface-variant tracking-wide uppercase">
              Order #/Ref
            </span>
            <div className="font-price-md text-price-md text-on-surface mt-0.5 tracking-tight">
              {reference}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-on-surface-variant tracking-wide uppercase">
              Status
            </span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <svg
                className="w-4 h-4 text-outline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <span className="font-price-md text-price-md text-primary">{total}</span>
            </div>
          </div>
        </div>
        <div className="pt-4 text-center">
          <span className="text-xs font-medium text-on-surface-variant">
            Estimated Delivery
          </span>
          <div className="text-sm font-semibold text-on-surface mt-0.5">
            1 – 5 business days
          </div>
        </div>
      </div>

      <div className="mt-7">
        <Link
          to={routes.home}
          className="inline-flex items-center justify-center px-8 py-3 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-semibold transition"
        >
          Continue Shopping
        </Link>
      </div>

      {items.length ? (
        <section className="w-full mt-12">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Order Items</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {items.map((item, index) => {
              const meta = [item.color, item.size].filter(Boolean).join(' \u2022 ');
              return (
                <div
                  key={`${item.productId}-${index}`}
                  className="bg-surface border border-outline-variant rounded-xl p-3 shadow-sm hover:shadow transition-shadow"
                >
                  <div className="w-full h-32 rounded-lg bg-surface-container overflow-hidden mb-3">
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover object-center"
                      fallbackClassName="w-full h-full flex items-center justify-center text-4xl"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-on-surface tracking-tight">{item.name}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                    {meta || `Qty: ${item.quantity}`}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {money(item.price * item.quantity)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
