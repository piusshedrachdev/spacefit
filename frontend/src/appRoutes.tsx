import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AdminLayout } from '@/layout/AdminLayout';
import { AdminDashboardPage, ADMIN_TABS } from '@/pages/AdminDashboardPage';
import { AuthLayout } from '@/layout/AuthLayout';
import { AuthPage } from '@/pages/AuthPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OrderSuccessPage } from '@/pages/OrderSuccessPage';
import { PoliciesPage } from '@/pages/PoliciesPage';
import { ProductDetailsPage } from '@/pages/ProductDetailsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RequireAuth } from '@/components/Visibility';
import { SellerApplyPage } from '@/pages/SellerApplyPage';
import { SELLER_TABS, SellerDashboardPage } from '@/pages/SellerDashboardPage';
import { SellerLayout } from '@/layout/SellerLayout';
import { StorefrontLayout } from '@/layout/StorefrontLayout';
import { WishlistPage } from '@/pages/WishlistPage';

/**
 * Route table (Phases 3–7): ported storefront + auth + seller + admin +
 * policies pages and the redirects that keep the legacy URLs/deep links
 * working — `.html` variants, the clean paths stored in notifications/emails,
 * the `#tab` hash links from seeded notifications (`admin.html#applications`),
 * the policy section anchors (`policies.html#returns`), and the typo'd
 * `order-succes.html?id=…` links.
 *
 * frontend/legacy/ was deleted at the Phase 7 cutover: the server hands every
 * non-API path the SPA shell, so these client routes ARE the pages now.
 *
 * `/auth` renders in its own minimal AuthLayout (the legacy auth page had no
 * store chrome); `/seller-dashboard` and `/admin` get their own console
 * shells; `/seller-apply` and `/policies` keep the full storefront shell.
 */

/** `/auth.html?next=…` → `/auth?next=…` — the query string is the point. */
function LegacyAuthRedirect() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={qs ? `/auth?${qs}` : '/auth'} replace />;
}

/** `/profile.html#settings|orders|saved` → the URL-backed profile tab. */
function LegacyProfileRedirect() {
  const location = useLocation();
  const hash = location.hash.replace('#', '');
  const tab = ['orders', 'saved', 'settings'].includes(hash) ? hash : null;
  return <Navigate to={tab ? `/profile/${tab}` : '/profile'} replace />;
}

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

/**
 * `/seller-dashboard.html#tab` (stored notification links) → the path form
 * `/seller-dashboard/:tab`; without a known hash, the bare dashboard.
 * The hash is never sent to the server, so it reads it client-side here.
 */
function LegacySellerDashboardRedirect() {
  const location = useLocation();
  const hash = location.hash.replace('#', '');
  const tab = SELLER_TABS.find((item) => item.id === hash && item.id !== 'overview');
  return (
    <Navigate to={tab ? `/seller-dashboard/${tab.id}` : '/seller-dashboard'} replace />
  );
}

/**
 * `/policies.html#returns|delivery|…` (footer + stored links) → `/policies`
 * with the same section id; without a hash, the bare page. The hash is read
 * client-side (never sent to the server) and preserved so the section still
 * resolves after the redirect.
 */
function LegacyPoliciesRedirect() {
  const location = useLocation();
  return (
    <Navigate to={{ pathname: '/policies', hash: location.hash }} replace />
  );
}

/**
 * `/admin.html#tab` (stored notification links, e.g. `#applications`) → the
 * path form `/admin/:tab`; without a known hash, the bare dashboard. The hash
 * is never sent to the server, so it reads it client-side here.
 */
function LegacyAdminRedirect() {
  const location = useLocation();
  const hash = location.hash.replace('#', '');
  const tab = ADMIN_TABS.find((item) => item.id === hash && item.id !== 'overview');
  return <Navigate to={tab ? `/admin/${tab.id}` : '/admin'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth stands alone (legacy auth.html had no store chrome). */}
      <Route element={<AuthLayout />}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth.html" element={<LegacyAuthRedirect />} />
      </Route>

      {/* Seller console (Phase 5) — its own chrome, like the legacy page. */}
      <Route element={<SellerLayout />}>
        <Route
          path="/seller-dashboard"
          element={
            <RequireAuth>
              <SellerDashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/seller-dashboard/:tab"
          element={
            <RequireAuth>
              <SellerDashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/seller-dashboard.html"
          element={<LegacySellerDashboardRedirect />}
        />
      </Route>

      {/* Admin console (Phase 6) — its own chrome, like the legacy page. */}
      <Route element={<AdminLayout />}>
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/:tab"
          element={
            <RequireAuth>
              <AdminDashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/admin.html" element={<LegacyAdminRedirect />} />
      </Route>

      <Route element={<StorefrontLayout />}>
        {/* Ported storefront (Phase 3) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/products/:id" element={<ProductDetailsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />

        {/* Wishlist (server-backed per account) */}
        <Route
          path="/wishlist"
          element={
            <RequireAuth>
              <WishlistPage />
            </RequireAuth>
          }
        />
        <Route path="/wishlist.html" element={<Navigate to="/wishlist" replace />} />

        {/* Shared personal profile (customer, seller, and admin) */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/:tab"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route path="/profile.html" element={<LegacyProfileRedirect />} />

        {/* Seller application (Phase 4) */}
        <Route path="/seller-apply" element={<SellerApplyPage />} />
        <Route
          path="/seller-apply.html"
          element={<Navigate to="/seller-apply" replace />}
        />

        {/* Store policies (Phase 7 — final page port) */}
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/policies.html" element={<LegacyPoliciesRedirect />} />

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
