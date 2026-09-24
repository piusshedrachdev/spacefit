import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ToastHost } from '@/layout/Chrome';
import { routes } from '@/lib/routes';

/**
 * Auth shell — port of the legacy auth.html chrome: its own minimal header
 * (logo + "Back to store"), a centered main for the card, and the toast
 * host. No storefront header/discount banner/footer: /auth renders here
 * instead of StorefrontLayout (the legacy page was standalone too).
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      <header className="w-full bg-surface-bright shadow-[0_1px_8px_rgba(41,37,36,0.05)]">
        <div className="h-20 w-full max-w-[1360px] mx-auto px-margin flex items-center justify-between">
          <Link className="flex items-center gap-space-sm" to={routes.home}>
            <img
              alt="SpaceFit"
              className="h-8 w-auto object-contain"
              src="/logo.jpeg"
            />
            <span className="font-headline-md text-headline-md text-primary tracking-tight">
              SpaceFit
            </span>
          </Link>
          <Link
            className="text-label-lg text-on-surface-variant hover:text-primary"
            to={routes.home}
          >
            Back to store
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-margin py-space-xl">
        {children ?? <Outlet />}
      </main>

      <ToastHost />
    </div>
  );
}
