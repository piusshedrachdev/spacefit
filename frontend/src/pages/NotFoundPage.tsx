import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';

/** Friendly 404 inside the shared chrome (unknown paths land here after cutover). */
export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-space-sm px-margin text-center">
      <span className="material-symbols-outlined text-6xl text-outline">search_off</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Page not found</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        The page you are looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        to={routes.home}
        className="mt-space-sm inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg font-semibold transition"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to the storefront
      </Link>
    </div>
  );
}
