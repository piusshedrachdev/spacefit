import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '@/appRoutes';
import { AppProviders } from '@/context/AppProviders';

/**
 * App shell: router + provider stack + route table (src/appRoutes.tsx).
 * Pages land route-by-route per frontend_react_migration_plan.md.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
