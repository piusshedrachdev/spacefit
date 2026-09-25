import { Link } from 'react-router-dom';
import { ProductGrid } from '@/components/commerce';
import { RequireAuth } from '@/components/Visibility';
import { useWishlist } from '@/context/WishlistProvider';
import { routes } from '@/lib/routes';

/**
 * `/wishlist` — the signed-in caller's saved products (server-backed via
 * /api/wishlist). Guests are sent to auth by the route guard instead of a
 * separate wishlist gate page.
 */

function WishlistContent() {
  const { items, loading } = useWishlist();

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

export function WishlistPage() {
  return (
    <RequireAuth>
      <WishlistContent />
    </RequireAuth>
  );
}
