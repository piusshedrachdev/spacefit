import { Link } from 'react-router-dom';
import { useSettings } from '@/context/SettingsProvider';
import { useToast, type ToastItem } from '@/context/ToastProvider';
import { routes } from '@/lib/routes';

/** Discount banner (chrome.js) — shown when settings.discounts.bannerEnabled. */
export function DiscountBanner() {
  const { settings } = useSettings();
  const discounts = settings?.discounts;
  if (!discounts?.bannerEnabled) return null;

  const parts: string[] = [];
  if (discounts.sitewidePercent) parts.push(`${discounts.sitewidePercent}% off sitewide`);
  if (discounts.promoCode) parts.push(`code ${discounts.promoCode}`);
  if (parts.length === 0) parts.push('Limited-time offer');

  return (
    <div className="w-full bg-primary text-on-primary text-center py-space-sm px-margin font-label-lg">
      <span className="material-symbols-outlined align-middle text-base">sell</span>{' '}
      {parts.join(' \u2022 ')}
    </div>
  );
}

function CartToast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-[88px] left-1/2 z-[60] flex min-w-[300px] max-w-[92vw] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface shadow-md transition-all sm:bottom-6"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-base text-primary">
          check
        </span>
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-on-surface sm:text-sm">Added to cart</span>
          <span className="block max-w-[180px] truncate text-xs text-on-surface-variant sm:max-w-[240px]">
            {item.message}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          className="text-xs font-bold text-primary underline transition-colors hover:text-secondary"
          to={routes.cart}
        >
          View cart
        </Link>
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="p-1 text-lg leading-none text-outline transition-colors hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            close
          </span>
        </button>
      </div>
    </div>
  );
}

/** Toast stack — generic messages stay top-right; cart confirmations use the
 * reference shop's bottom-centre "Added to cart" feedback. */
export function ToastHost() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  const standardToasts = toasts.filter((item) => item.kind === 'default');
  const cartToast = toasts.find((item) => item.kind === 'cart');

  return (
    <>
      {standardToasts.length > 0 ? (
        <div className="fixed top-24 right-8 z-[60] flex flex-col gap-space-sm items-end">
          {standardToasts.map((item) => (
            <div
              key={item.id}
              role="status"
              className={[
                'flex items-center gap-space-sm px-space-lg py-space-md rounded-xl shadow-xl transition-all duration-300',
                item.isError ? 'bg-error text-on-error' : 'bg-inverse-surface text-inverse-on-surface'
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-xl">
                {item.isError ? 'error' : 'check_circle'}
              </span>
              <span className="font-body-sm">{item.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(item.id)}
                className="ml-space-md text-surface-dim hover:text-inverse-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {cartToast ? (
        <CartToast item={cartToast} onDismiss={() => dismiss(cartToast.id)} />
      ) : null}
    </>
  );
}

const COLLECTIONS = [
  { label: 'Living Room', href: '#' },
  { label: 'Bedroom Sanctuary', href: '#' },
  { label: 'Dining & Vessels', href: '#' },
  { label: 'Executive Studios', href: '#' },
  { label: 'Architectural Lighting', href: '#' }
];

const SHOWROOMS = [
  { label: 'Lagos Flagship Gallery', href: '#' },
  { label: 'Abuja Design Suite', href: '#' },
  { label: 'Care & Timber', href: '#' },
  { label: 'Trade Programme', href: '#' }
];

/** Shared footer, including the chrome.js policy links row. */
export function Footer() {
  return (
    <footer className="w-full bg-surface-container-low text-on-surface-variant mt-space-2xl">
      <div className="max-w-[1360px] mx-auto px-margin pt-space-2xl pb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg pb-space-2xl border-b border-outline-variant/30">
          <div className="lg:col-span-5 space-y-space-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight block">
              SpaceFit
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
              Curated architectural pieces, sculptural ceramics, and mindful spatial furniture
              designed for deliberate contemporary living.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-gutter">
            <div className="space-y-space-sm">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Collections
              </h4>
              <ul className="space-y-space-xs font-body-md text-body-md">
                {COLLECTIONS.map((item) => (
                  <li key={item.label} className="hover:text-primary transition-colors">
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-space-sm">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Showrooms &amp; Care
              </h4>
              <ul className="space-y-space-xs font-body-md text-body-md">
                {SHOWROOMS.map((item) => (
                  <li key={item.label} className="hover:text-primary transition-colors">
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-xl">
          <p className="font-body-sm text-body-sm">
            &copy; {new Date().getFullYear()} SpaceFit. All rights reserved.
          </p>
          {/* chrome.js policy links */}
          <div id="chromePolicies" className="text-center">
            <a className="mx-space-sm text-on-surface-variant hover:text-primary" href={routes.policies}>
              Policies
            </a>
            <a
              className="mx-space-sm text-on-surface-variant hover:text-primary"
              href={`${routes.policies}#returns`}
            >
              Returns
            </a>
            <a
              className="mx-space-sm text-on-surface-variant hover:text-primary"
              href={`${routes.policies}#delivery`}
            >
              Delivery
            </a>
            <a
              className="mx-space-sm text-on-surface-variant hover:text-primary"
              href={`${routes.policies}#privacy`}
            >
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
