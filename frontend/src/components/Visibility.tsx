import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { Spinner } from '@/ui';
import { can as rules, type Visibility, type VisibilityRule } from '@/lib/permissions';
import { routes } from '@/lib/routes';
import type { Role } from '@/types/api';

/**
 * Visibility primitives — the single place that decides *what is rendered
 * for whom*. See src/lib/permissions.ts for the rules themselves.
 */

export function useVisibility(): Visibility {
  const { isAuthenticated, role } = useAuth();
  return { isAuthenticated, role };
}

/** Renders only for signed-in visitors. */
export function AuthOnly({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  return <>{isAuthenticated ? children : fallback}</>;
}

/** Renders only for signed-out visitors (guests). */
export function GuestOnly({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  return <>{!isAuthenticated ? children : fallback}</>;
}

/** Renders only for the listed roles. */
export function RoleOnly({
  roles,
  children,
  fallback = null
}: {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role } = useAuth();
  return <>{roles.includes(role) ? children : fallback}</>;
}

/** Renders when a named permission rule passes. */
export function IfCan({
  rule,
  children,
  fallback = null
}: {
  rule: keyof typeof rules;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const visibility = useVisibility();
  const check: VisibilityRule = rules[rule];
  return <>{check(visibility) ? children : fallback}</>;
}

/** Friendly "no access" panel for wrong-role visitors. */
export function AccessDenied({ role }: { role: string }) {
  return (
    <div className="max-w-lg mx-auto mt-space-2xl p-space-xl bg-surface-container-lowest rounded-xl border border-outline-variant/50 text-center space-y-space-sm">
      <span className="material-symbols-outlined text-5xl text-outline">lock</span>
      <h1 className="font-headline-md text-headline-md text-on-surface">
        You don&apos;t have access to this area
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        This page is restricted. You are currently signed in as{' '}
        <span className="font-semibold capitalize">{role}</span>.
      </p>
      <a
        href={routes.home}
        className="inline-block font-label-lg text-label-lg text-primary underline underline-offset-4"
      >
        Back to the storefront
      </a>
    </div>
  );
}

/**
 * Route-level guard: redirects signed-out visitors to auth (?next=…) and
 * shows <AccessDenied/> for the wrong role. Used by the dashboards
 * (Phases 5–6); defined here so every gated route behaves identically.
 */
export function RequireRole({
  roles,
  children
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { isAuthenticated, role, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-space-2xl">
        <Spinner />
      </div>
    );
  }
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${routes.auth}?next=${next}`} replace />;
  }
  if (!roles.includes(role)) {
    return <AccessDenied role={role} />;
  }
  return <>{children}</>;
}
