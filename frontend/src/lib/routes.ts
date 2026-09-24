/**
 * Navigation targets.
 *
 * Every target is served by the React app (the Vite migration finished in
 * Phase 7 — `frontend/legacy/` is gone); legacy URLs (`.html` paths, clean
 * paths, `#hash` links from seeded notifications and emails) keep resolving
 * through the redirects in src/appRoutes.tsx.
 *
 * Targets are root-absolute (`/auth`) so they resolve from nested SPA routes
 * like `/products/:id`; the old typo'd confirmation URL
 * (`order-succes.html?id=…`) is preserved via a redirect in src/appRoutes.tsx.
 */
export const routes = {
  home: '/',
  shop: '/#shop',
  cart: '/cart',
  checkout: '/checkout',
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
  orderSuccess: (id: string) => `/order-success/${encodeURIComponent(id)}`,
  auth: '/auth',
  sellerApply: '/seller-apply',
  sellerDashboard: '/seller-dashboard',
  admin: '/admin',
  policies: '/policies'
} as const;

/** True when a nav target is served by the React router (vs a legacy page). */
export function isSpaHref(href: string): boolean {
  return href.startsWith('/') && !href.includes('.html');
}
