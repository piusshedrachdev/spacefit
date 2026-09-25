import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AccountControl, NotificationBell } from '@/layout/Header';
import { ToastHost } from '@/layout/Chrome';
import { routes } from '@/lib/routes';

/**
 * Admin console shell — port of the legacy admin.html chrome: own compact
 * header (logo + "Admin" chip, Store link, bell → #overview, account), the
 * dashboard main column, and the "Admin console" footer. No storefront
 * header/footer (the legacy page was standalone); account + bell decorations
 * are shared with the storefront via Header — the bell only overrides the
 * target (legacy admin.html pointed it at admin.html#overview).
 *
 * Used as a route element (children omitted → <Outlet/>) and with explicit
 * children in tests, like StorefrontLayout/AuthLayout/SellerLayout.
 */
export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-bright/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(41,37,36,0.05)]">
        <div className="h-20 w-full max-w-[1360px] mx-auto px-margin flex items-center justify-between gap-gutter">
          <Link
            className="flex items-center gap-space-sm shrink-0"
            to={routes.home}
          >
            <img
              alt="SpaceFit Brand Logo"
              className="h-8 w-auto object-contain"
              src="/logo.png"
            />
            <span className="font-headline-md text-headline-md text-primary tracking-tight">
              SpaceFit
            </span>
            <span className="ml-space-sm font-label-md px-space-sm py-space-xs rounded-full bg-primary text-on-primary">
              Admin
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-space-lg">
            <Link
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary"
              to={routes.home}
            >
              Store
            </Link>
          </nav>
          <div className="flex items-center gap-space-sm">
            <NotificationBell href={`${routes.admin}#overview`} />
            <div className="h-5 w-px bg-outline-variant/40 mx-space-xs hidden sm:block" />
            <AccountControl />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-margin pt-28 pb-space-2xl">
        {children ?? <Outlet />}
      </main>

      <footer className="w-full bg-surface-container-low border-t border-outline-variant/40">
        <div className="max-w-[1360px] mx-auto px-margin py-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm">
          <p className="font-body-sm text-on-surface-variant">
            {'\u00a9'} SpaceFit Studio Limited {'\u2022'} Admin console
          </p>
          <Link
            className="font-label-md text-on-surface-variant hover:text-primary"
            to={routes.home}
          >
            Back to store
          </Link>
        </div>
      </footer>

      <ToastHost />
    </div>
  );
}
