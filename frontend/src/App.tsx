import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/context/AppProviders';
import { StorefrontLayout } from '@/layout/StorefrontLayout';

/**
 * Phase 1/2 shell: the placeholder home wrapped in the real chrome.
 * Pages land route-by-route in Phases 3–7 (frontend_react_migration_plan.md).
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route
            path="/"
            element={
              <StorefrontLayout>
                <section className="min-h-[60vh] flex flex-col items-center justify-center gap-space-md px-margin text-center">
                  <img src="/logo.jpeg" alt="SpaceFit" className="w-24 rounded-xl shadow-sm" />
                  <h1 className="font-headline-lg text-headline-lg text-primary">SpaceFit</h1>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                    React + TypeScript storefront — migration in progress (Phase 2 core
                    platform). The live site is still served from the legacy pages.
                  </p>
                  <a
                    href="/policies.html"
                    className="font-label-lg text-label-lg text-primary underline underline-offset-4"
                  >
                    View the legacy site
                  </a>
                </section>
              </StorefrontLayout>
            }
          />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
