import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useNotifications } from '@/context/NotificationsProvider';
import { routes } from '@/lib/routes';

/**
 * Storefront header — a port of the legacy header markup plus the chrome.js
 * decorations (account control, notification bell), in that order of
 * operations: wishlist, bell (authed only), cart, divider, account.
 */

function NavAnchor({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="relative py-space-sm font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
    >
      {children}
    </a>
  );
}

function IconButtonLink({
  href,
  label,
  badge,
  badgeClass = 'bg-primary text-on-primary',
  children
}: {
  href: string;
  label: string;
  badge?: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      aria-label={label}
      href={href}
      className="relative p-space-sm rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all flex items-center justify-center"
    >
      {children}
      {badge ? (
        <span
          className={`absolute top-1 right-1 min-w-4 h-4 px-1 font-label-sm text-[10px] rounded-full flex items-center justify-center font-bold ${badgeClass}`}
        >
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  if (!isAuthenticated) return null;

  const badge = unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : undefined;

  return (
    <IconButtonLink
      href={`${routes.sellerDashboard}#notifications`}
      label="Notifications"
      badge={badge}
    >
      <span className="material-symbols-outlined text-2xl">notifications</span>
    </IconButtonLink>
  );
}

function AccountControl() {
  const { isAuthenticated, profile, user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click (legacy chrome.js behaviour).
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  if (!isAuthenticated) {
    return (
      <a
        href={routes.auth}
        title="Sign in"
        aria-label="Sign in"
        className="p-0.5 rounded-full ring-1 ring-outline-variant/50 hover:ring-primary transition-all flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-2xl">person</span>
      </a>
    );
  }

  const label = profile?.full_name || user?.email || 'Account';
  const dashboard =
    role === 'admin'
      ? { href: routes.admin, label: 'Admin dashboard' }
      : role === 'seller'
        ? { href: routes.sellerDashboard, label: 'Seller dashboard' }
        : null;

  const onSignOut = () => {
    void logout().then(() => {
      window.location.assign(routes.home);
    });
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
        className="p-0.5 rounded-full ring-1 ring-outline-variant/50 hover:ring-primary transition-all flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-2xl text-on-surface-variant">
          account_circle
        </span>
      </button>
      <div
        className={`${open ? '' : 'hidden'} absolute right-0 mt-space-sm w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 py-space-sm z-50`}
      >
        <div className="px-space-md py-space-sm border-b border-outline-variant/30">
          <p className="font-label-md text-on-surface truncate">{label}</p>
          <p className="font-body-sm text-on-surface-variant capitalize">{role}</p>
        </div>
        {dashboard ? (
          <a
            href={dashboard.href}
            className="flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            {dashboard.label}
          </a>
        ) : null}
        <a
          href={routes.sellerApply}
          className="flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-xl">storefront</span>
          Become a Seller
        </a>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-left flex items-center gap-space-sm px-space-md py-space-sm hover:bg-surface-container-high text-error"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-bright/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(41,37,36,0.05)]">
      <div className="h-20 w-full max-w-[1360px] mx-auto px-margin flex items-center justify-between gap-gutter">
        <Link className="flex items-center gap-space-sm shrink-0" to={routes.home}>
          <img
            alt="SpaceFit Brand Logo"
            className="h-8 w-auto object-contain"
            src="/logo.jpeg"
          />
          <span className="font-headline-md text-headline-md text-primary tracking-tight">
            SpaceFit
          </span>
        </Link>

        <div className="flex items-center gap-space-lg">
          <nav className="hidden md:flex items-center gap-space-lg">
            <NavAnchor href={routes.home}>Home</NavAnchor>
            <NavAnchor href={routes.shop}>Shop</NavAnchor>
            <NavAnchor href={routes.home}>Products</NavAnchor>
          </nav>

          <div className="flex items-center gap-space-sm">
            <IconButtonLink href="#" label="Wishlist" badge="2">
              <span className="material-symbols-outlined text-2xl">favorite</span>
            </IconButtonLink>

            <NotificationBell />

            <IconButtonLink
              href={routes.cart}
              label="Cart"
              badge={itemCount > 0 ? String(itemCount) : undefined}
              badgeClass="bg-secondary-container text-on-secondary-container"
            >
              <span className="material-symbols-outlined text-2xl">local_mall</span>
            </IconButtonLink>

            <div className="h-5 w-px bg-outline-variant/40 mx-space-xs hidden sm:block" />

            <AccountControl />
          </div>
        </div>
      </div>
    </header>
  );
}
