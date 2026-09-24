import { useSettings } from '@/context/SettingsProvider';
import { useToast } from '@/context/ToastProvider';
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

/** Toast stack — port of chrome.js toast() (top-right, 3.2s auto-dismiss). */
export function ToastHost() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-24 right-8 z-[60] flex flex-col gap-space-sm items-end">
      {toasts.map((item) => (
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
