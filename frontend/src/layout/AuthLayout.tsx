import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { ToastHost } from '@/layout/Chrome';
import { routes } from '@/lib/routes';

/**
 * Standalone auth shell.
 *
 * This mirrors the reference auth page's quiet header and desktop split
 * layout without bringing the storefront navigation, discount banner, or
 * footer into the sign-in journey.
 */
export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-body-md text-on-surface antialiased">
      <header className="w-full border-b border-outline-variant/50 bg-surface-bright/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-[1360px] items-center px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-space-sm" to={routes.home}>
            <img
              alt="SpaceFit"
              className="h-8 w-auto object-contain"
              src="/logo.png"
            />
            <span className="font-headline-md text-headline-md tracking-tight text-primary">
              SpaceFit
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-2">
          <AuthBrandPanel />
          <div className="flex items-center justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            {children ?? <Outlet />}
          </div>
        </section>
      </main>

      <ToastHost />
    </div>
  );
}
