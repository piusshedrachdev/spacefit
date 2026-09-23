/**
 * Navigation targets.
 *
 * While the Vite migration is in progress (frontend_react_migration_plan.md)
 * pages that are not yet ported point at their legacy `.html` URL — the backend
 * still serves them from `frontend/legacy/`. Flip a value to the SPA path in
 * the same phase that ported the page (one-line change per route).
 */
export const routes = {
  /** Ported in Phase 3 — served by the React app. */
  home: '/',
  shop: '/#shop',
  cart: 'cart.html',
  checkout: 'checkout.html',
  product: (id: string) => `product-details.html?id=${encodeURIComponent(id)}`,
  /** Filename typo preserved — links/emails depend on it. */
  orderSuccess: (id: string) => `order-succes.html?id=${encodeURIComponent(id)}`,
  auth: 'auth.html',
  sellerApply: 'seller-apply.html',
  sellerDashboard: 'seller-dashboard.html',
  admin: 'admin.html',
  policies: 'policies.html'
} as const;
