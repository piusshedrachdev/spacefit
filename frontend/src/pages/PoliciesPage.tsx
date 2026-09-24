import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { SmartLink } from '@/components/SmartLink';
import { useToast } from '@/context/ToastProvider';
import { getConfig, getSettings } from '@/api/meta';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { StorePolicies, StoreSettings } from '@/types/api';

/**
 * Store policies — port of legacy policies.html + js/policies.js.
 *
 * Static sections keep the legacy ids (`#returns`, `#delivery`, `#sellers`,
 * `#privacy`, `#discounts`) so the in-page anchors and stored deep links keep
 * resolving; the policy copy, free-delivery note, discount card and "Last
 * updated" stamp come from GET /api/meta/settings (with /api/meta/config as
 * the free-delivery fallback, exactly like legacy init()). A failed settings
 * call degrades the same way: placeholder copy everywhere, the legacy error
 * banner at the top of the panel and an error toast.
 */
export function PoliciesPage() {
  const { toast } = useToast();
  // 'loading' renders the legacy empty placeholders; 'ready' the fetched
  // copy; 'error' the placeholder + banner combination (legacy fail()).
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [freeThreshold, setFreeThreshold] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = ((await getSettings()) || {}) as StoreSettings;
        if (cancelled) return;
        setSettings(data);
        setPhase('ready');

        // The free-delivery note prefers the saved threshold and only falls
        // back to /api/meta/config (500000 default) like legacy init().
        const threshold = data.discounts?.freeDeliveryThreshold;
        if (threshold) {
          setFreeThreshold(threshold);
          return;
        }
        try {
          const config = await getConfig();
          if (!cancelled) setFreeThreshold(config?.freeDeliveryThreshold || 500000);
        } catch {
          if (!cancelled) setFreeThreshold(500000);
        }
      } catch {
        if (cancelled) return;
        setPhase('error');
        const message = 'Could not load store policies. Please refresh the page.';
        setLoadError(message);
        toast(message, true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Legacy renderPolicies(): trimmed copy, else the unpublished placeholder;
  // while loading the legacy markup left the slots empty.
  const policyText = (key: keyof StorePolicies): string => {
    if (phase === 'loading') return '';
    const text = settings?.policies?.[key];
    return (text && String(text).trim()) || PLACEHOLDER;
  };

  const discounts = settings?.discounts;
  const discountActive = Boolean(
    discounts?.bannerEnabled &&
      (Number(discounts.sitewidePercent) > 0 || !!discounts.promoCode)
  );

  // Legacy renderUpdated(): stamp lives outside StoreSettings on some
  // payloads (both spellings were read); only rendered after a successful load.
  const stampSource = settings as
    | (StoreSettings & { updated_at?: string; updatedAt?: string })
    | null;
  const stamp =
    phase === 'ready' ? stampSource?.updated_at || stampSource?.updatedAt : undefined;

  return (
    <div className="max-w-5xl w-full mx-auto px-margin pt-8 pb-space-2xl">
      <div className="mb-space-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Store policies
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-space-sm">
          The current policies maintained by the SpaceFit team {'\u2014'} the same
          text shown at checkout and in your order emails.
        </p>
        <p className="font-body-sm text-on-surface-variant mt-space-xs" id="policiesUpdated">
          {stamp
            ? `Last updated ${new Date(stamp).toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}`
            : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg">
        {/* In-page nav (legacy markup) */}
        <nav className="lg:col-span-3">
          <div className="lg:sticky lg:top-28 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-space-md space-y-space-sm">
            <a className="block font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#returns">
              Returns &amp; refunds
            </a>
            <a className="block font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#delivery">
              Delivery
            </a>
            <a className="block font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#sellers">
              Selling on SpaceFit
            </a>
            <a className="block font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#privacy">
              Privacy
            </a>
            <a className="block font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#discounts">
              Discounts &amp; offers
            </a>
          </div>
        </nav>

        {/* Policy sections (legacy ids preserved for stored deep links) */}
        <div className="lg:col-span-9 space-y-space-lg" id="policiesPanel">
          {loadError ? (
            <div className="rounded-xl bg-error-container text-on-error-container px-space-md py-space-sm font-body-sm">
              {loadError}
            </div>
          ) : null}

          <PolicySection id="returns" icon="replay" title="Returns & refunds">
            <PolicyBody>{policyText('returnPolicy')}</PolicyBody>
          </PolicySection>

          <PolicySection id="delivery" icon="local_shipping" title="Delivery">
            <PolicyBody>{policyText('deliveryPolicy')}</PolicyBody>
            {phase === 'ready' && freeThreshold != null ? (
              <p className="mt-space-md font-body-sm text-on-surface-variant" id="freeDeliveryNote">
                Delivery is free on orders of{' '}
                <strong>{formatPrice(freeThreshold)}</strong> and above.
              </p>
            ) : null}
          </PolicySection>

          <PolicySection id="sellers" icon="storefront" title="Selling on SpaceFit">
            <PolicyBody>{policyText('sellerPolicy')}</PolicyBody>
            <SmartLink
              href={routes.sellerApply}
              className="inline-flex items-center gap-space-sm mt-space-md bg-primary text-on-primary px-space-lg py-space-sm rounded-lg font-label-lg hover:opacity-95 transition-opacity"
            >
              Apply to sell
            </SmartLink>
          </PolicySection>

          <PolicySection id="privacy" icon="shield_lock" title="Privacy">
            <PolicyBody>{policyText('privacyPolicy')}</PolicyBody>
          </PolicySection>

          <PolicySection id="discounts" icon="sell" title="Discounts & offers">
            <div className="mt-space-md" id="discountsPanel">
              {phase === 'loading' ? null : discountActive ? (
                <div className="rounded-xl bg-primary/10 border border-primary/30 p-space-md">
                  <ul className="space-y-space-sm font-body-md text-body-md text-on-surface">
                    {Number(discounts?.sitewidePercent) > 0 ? (
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-primary" aria-hidden="true">
                          percent
                        </span>
                        <span>
                          <strong>{discounts?.sitewidePercent}% off</strong> sitewide
                        </span>
                      </li>
                    ) : null}
                    {discounts?.promoCode ? (
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-primary" aria-hidden="true">
                          confirmation_number
                        </span>
                        <span>
                          Use code{' '}
                          <strong className="tracking-wide">{discounts.promoCode}</strong> at
                          checkout
                        </span>
                      </li>
                    ) : null}
                    {discounts?.freeDeliveryThreshold ? (
                      <li className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-primary" aria-hidden="true">
                          local_shipping
                        </span>
                        <span>
                          Free delivery above{' '}
                          <strong>{formatPrice(discounts.freeDeliveryThreshold)}</strong>
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  There are no active discounts right now. Subscribe to the footer newsletter
                  to hear about the next one.
                </p>
              )}
            </div>
          </PolicySection>
        </div>
      </div>
    </div>
  );
}

const PLACEHOLDER =
  'This policy has not been published yet. Check back soon or contact support@spacefit.ng.';

function PolicySection({
  id,
  icon,
  title,
  children
}: {
  id: string;
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-space-lg scroll-mt-28"
    >
      <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-space-sm">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Legacy `[data-policy]` slot — whitespace kept as authored (pre-line). */
function PolicyBody({ children }: { children: ReactNode }) {
  return (
    <div className="mt-space-md font-body-md text-body-md text-on-surface-variant whitespace-pre-line">
      {children}
    </div>
  );
}
