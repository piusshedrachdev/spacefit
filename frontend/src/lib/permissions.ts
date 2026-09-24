import type { Role } from '@/types/api';

/** The caller's identity, as needed by visibility rules. */
export interface Visibility {
  isAuthenticated: boolean;
  role: Role;
}

export type VisibilityRule = (v: Visibility) => boolean;

/**
 * Central "who sees what" rules. Components ask `can.x(visibility)` (or use
 * <IfCan>/<AuthOnly>/<RoleOnly> from src/components/Visibility.tsx) instead
 * of re-deriving role logic at every call site.
 */
export const can = {
  /** Bell, account menu, reviews, personalized prefill. */
  seeAccountFeatures: (v: Visibility) => v.isAuthenticated,

  /** Write product reviews. */
  writeReviews: (v: Visibility) => v.isAuthenticated,

  /**
   * "Become a Seller" pitch — customers (incl. signed-out visitors, whose
   * effective role is `customer`) see it; active sellers and admins don't.
   */
  applyAsSeller: (v: Visibility) => v.role === 'customer',

  /** Dashboard entry in the account menu. */
  seeDashboardLink: (v: Visibility) => v.role === 'seller' || v.role === 'admin',
  openSellerDashboard: (v: Visibility) => v.role === 'seller',
  openAdmin: (v: Visibility) => v.role === 'admin',

  /**
   * Consultation banner/modal (Phase 3): signed-in customers only —
   * sellers/admins are routed to their dashboards instead.
   */
  seeConsultation: (v: Visibility) => v.isAuthenticated && v.role === 'customer',

  /** Guest checkout stays allowed (legacy parity). */
  checkout: (_v: Visibility) => true,

  /** Catalogue moderation (admin) and own-product management (seller/admin). */
  moderateCatalogue: (v: Visibility) => v.role === 'admin',
  manageOwnCatalogue: (v: Visibility) => v.role === 'seller' || v.role === 'admin'
} satisfies Record<string, VisibilityRule>;
