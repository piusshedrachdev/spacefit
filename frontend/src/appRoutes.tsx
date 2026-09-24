import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OrderSuccessPage } from '@/pages/OrderSuccessPage';
import { ProductDetailsPage } from '@/pages/ProductDetailsPage';
import { StorefrontLayout } from '@/layout/StorefrontLayout';

/**
 * Route table (Phase 3): ported storefront pages + redirects that keep the
 * legacy URLs/deep links working — `.html` variants, the clean paths stored
 * in notifications/emails, and the typo'd `order-succes.html?id=…` links.
 *
 * While legacy files still exist the server serves them directly; these
 * redirects take over once a page is pruned from frontend/legacy/ (Phase 7),
 * and cover the clean paths (`/cart`, `/products/:id`, …) right away.
 */

/** `/product-details.html?id=…` (and the clean variant) → `/products/:id`. */
function LegacyProductRedirect() {
  const [params] = useSearchParams();
  const id = params.get('id') || 'luna-bed'; // legacy default
  return <Navigate to={`/products/${encodeURIComponent(id)}`} replace />;
}

/** `/product-details/:id` (path form, also in the SPA_ROUTES manifest). */
function LegacyProductPathRedirect() {
  const { id } = useParams();
  return <Navigate to={`/products/${encodeURIComponent(id ?? 'luna-bed')}`} replace />;
}

/**
 * `/order-succes.html?id=…` — the filename typo emails and stored links
 * depend on — → `/order-success/:id`; without an id, the bare confirmation.
 */
function LegacyOrderSuccessRedirect() {
  const [params] = useSearchParams();
  const id = params.get('id');
  return (
    <Navigate
      to={id ? `/order-success/${encodeURIComponent(id)}` : '/order-success'}
      replace
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        {/* Ported storefront (Phase 3) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/products/:id" element={<ProductDetailsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />

        {/* Legacy URL compatibility */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/cart.html" element={<Navigate to="/cart" replace />} />
        <Route path="/checkout.html" element={<Navigate to="/checkout" replace />} />
        <Route path="/product-details" element={<LegacyProductRedirect />} />
        <Route path="/product-details.html" element={<LegacyProductRedirect />} />
        <Route path="/product-details/:id" element={<LegacyProductPathRedirect />} />
        <Route path="/order-succes" element={<LegacyOrderSuccessRedirect />} />
        <Route path="/order-succes.html" element={<LegacyOrderSuccessRedirect />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
