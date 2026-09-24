/**
 * Navigation targets.
 *
 * While the Vite migration is in progress (frontend_react_migration_plan.md)
 * pages that are not yet ported point at their legacy `.html` URL — the backend
 * still serves them from `frontend/legacy/`. Flip a value to the SPA path in
 * the same phase that ported the page (one-line change per route).
 *
 * Legacy targets are root-absolute (`/auth.html`) so they keep resolving from
 * nested SPA routes like `/products/:id`; the old typo'd confirmation URL
 * (`order-succes.html?id=…`) is preserved via a redirect in src/appRoutes.tsx.
 */
export const routes = {
  /** Ported in Phases 3–4 — served by the React app. */
  home: '/',
  shop: '/#shop',
  cart: '/cart',
  checkout: '/checkout',
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
  orderSuccess: (id: string) => `/order-success/${encodeURIComponent(id)}`,
  auth: '/auth',
  sellerApply: '/seller-apply',
  /** Legacy pages — ported in Phases 5–7 (flip one line each). */
  sellerDashboard: '/seller-dashboard.html',
  admin: '/admin.html',
  policies: '/policies.html'
} as const;

/** True when a nav target is served by the React router (vs a legacy page). */
export function isSpaHref(href: string): boolean {
  return href.startsWith('/') && !href.includes('.html');
}
