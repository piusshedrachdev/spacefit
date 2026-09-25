import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/appRoutes';
import { AppProviders } from '@/context/AppProviders';
import SwiftAgentWidget from './components/SwiftAgentWidget';

function GlobalWidget() {
  const { pathname } = useLocation();

  if (pathname === '/auth' || pathname === '/auth.html') return null;
  return <SwiftAgentWidget />;
}

/**
 * App shell: router + provider stack + route table (src/appRoutes.tsx).
 * Pages land route-by-route per frontend_react_migration_plan.md.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <GlobalWidget />
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
