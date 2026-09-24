import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { DiscountBanner, Footer, ToastHost } from '@/layout/Chrome';
import { Header } from '@/layout/Header';

/**
 * Shared storefront shell: discount banner + fixed header + page body +
 * footer + toast host (the pieces chrome.js used to decorate per page).
 * Used both as a route element (children omitted → <Outlet/>) and with
 * explicit children in tests.
 */
export function StorefrontLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DiscountBanner />
      <Header />
      <main className="w-full pt-20 flex-1 bg-background">{children ?? <Outlet />}</main>
      <Footer />
      <ToastHost />
    </div>
  );
}
