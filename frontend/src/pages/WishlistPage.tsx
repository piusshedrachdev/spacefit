import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProductGrid } from '@/components/commerce';
import { useAuth } from '@/context/AuthProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { routes } from '@/lib/routes';

/**
 * `/wishlist` — the signed-in caller's saved products (server-backed via
 * /api/wishlist). Signed-out visitors get the branded sign-in gate the
 * seller/admin dashboards use.
 */

const GATE_CTA_CLASS =
  'inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95';

/** Same shell the seller/admin gates use (kept local — pages stay self-contained). */
function GateShell({
  title,
  icon,
  tone,
  children,
  cta
}: {
  title: string;
  icon: string;
  tone: string;
  children: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">
      <span
        className={`material-symbols-outlined text-5xl ${tone}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <h1 className="font-headline-lg text-headline-lg mt-space-md">{title}</h1>
      <div className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">
        {children}
      </div>
      {cta ? <div className="mt-space-lg">{cta}</div> : null}
    </div>
  );
}

export function WishlistPage() {
  const { isAuthenticated } = useAuth();
  const { items, loading } = useWishlist();

  if (!isAuthenticated) {
    return (
      <GateShell
        title="Sign in to see your wishlist"
        icon="favorite"
        tone="text-primary"
        cta={
          <Link
            className={GATE_CTA_CLASS}
            to={`${routes.auth}?next=${encodeURIComponent(routes.wishlist)}`}
          >
            Sign in
          </Link>
        }
      >
        <p>Save the pieces you love and pick up right where you left off, on any device.</p>
      </GateShell>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-margin py-space-2xl">
      <div className="flex items-end justify-between gap-gutter mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg">My Wishlist</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {items.length} saved {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Link
          to={routes.shop}
          className="font-label-lg text-label-lg text-primary hover:underline"
        >
          Browse the shop
        </Link>
      </div>

      <ProductGrid
        products={items}
        loading={loading}
        empty={
          <div className="text-center py-space-2xl">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              favorite
            </span>
            <p className="font-headline-sm text-headline-sm mt-space-md">No saved items yet.</p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              Tap the heart on any product to save it here.
            </p>
            <Link
              to={routes.shop}
              className="inline-block mt-space-lg bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95"
            >
              Browse the shop
            </Link>
          </div>
        }
      />
    </div>
  );
}
