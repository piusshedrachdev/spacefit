import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMyOrders } from '@/api/orders';
import { ProductGrid } from '@/components/commerce';
import { useAuth } from '@/context/AuthProvider';
import { useSettings } from '@/context/SettingsProvider';
import { useToast } from '@/context/ToastProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Button, Card, EmptyState, Input, Spinner, StatusPill } from '@/ui';
import type { Order, Profile } from '@/types/api';

type ProfileTab = 'orders' | 'saved' | 'settings';

interface ProfileTabItem {
  id: ProfileTab;
  label: string;
  icon: string;
}

const PROFILE_TABS: ProfileTabItem[] = [
  { id: 'orders', label: 'Orders', icon: 'receipt_long' },
  { id: 'saved', label: 'Saved items', icon: 'favorite' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];

function displayName(profile: Profile | null, email: string | null | undefined): string {
  return profile?.full_name?.trim() || email?.split('@')[0] || 'SpaceFit member';
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short'
  });
}

function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrator';
  if (role === 'seller') return 'Seller account';
  return 'Buyer account';
}

function accountTools(role: string): Array<{ label: string; href: string; icon: string }> {
  if (role === 'admin') {
    return [
      { label: 'Admin dashboard', href: routes.admin, icon: 'admin_panel_settings' },
      { label: 'Store settings', href: `${routes.admin}/settings`, icon: 'tune' }
    ];
  }
  if (role === 'seller') {
    return [
      { label: 'Seller dashboard', href: routes.sellerDashboard, icon: 'dashboard' },
      {
        label: 'Shop profile',
        href: `${routes.sellerDashboard}/profile`,
        icon: 'storefront'
      }
    ];
  }
  return [{ label: 'Become a seller', href: routes.sellerApply, icon: 'storefront' }];
}

function ProfileSummary({
  name,
  email,
  role,
  createdAt,
  orderCount,
  savedCount
}: {
  name: string;
  email: string;
  role: string;
  createdAt?: string | null;
  orderCount: number | null;
  savedCount: number;
}) {
  return (
    <Card className="border border-outline-variant/60 p-5 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container/20 font-headline-lg text-primary sm:h-24 sm:w-24">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="font-headline-md text-headline-md text-on-surface">{name}</h1>
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                {roleLabel(role)}
              </span>
            </div>
            <p className="truncate font-body-md text-body-md text-on-surface-variant">{email}</p>
            {createdAt ? (
              <p className="mt-1 font-body-sm text-body-sm text-outline">
                Member since {formatDate(createdAt)}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          className="inline-flex items-center justify-center gap-space-xs rounded-lg border border-outline-variant px-space-lg py-space-sm font-label-md text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary"
          to={routes.profileTab('settings')}
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          Edit profile
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 border-t border-outline-variant/50 pt-5 sm:grid-cols-3 sm:divide-x sm:divide-outline-variant/50">
        <ProfileStat label="Orders" value={orderCount === null ? '—' : String(orderCount)} />
        <ProfileStat label="Saved items" value={String(savedCount)} />
        <ProfileStat label="Account" value={roleLabel(role)} />
      </div>
    </Card>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 sm:block sm:px-6 sm:py-0 first:sm:pl-0 last:sm:pr-0">
      <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
      <p className="font-headline-sm text-headline-sm text-on-surface sm:mt-1">{value}</p>
    </div>
  );
}

function ProfileTabs({ active }: { active: ProfileTab }) {
  return (
    <nav
      aria-label="Profile sections"
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-outline-variant/60 px-1"
    >
      {PROFILE_TABS.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            aria-current={selected ? 'page' : undefined}
            className={[
              'inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 font-label-md text-label-md transition-colors',
              selected
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            ].join(' ')}
            key={item.id}
            to={routes.profileTab(item.id)}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileEmptyState({
  title,
  hint,
  icon,
  cta
}: {
  title: string;
  hint: string;
  icon: string;
  cta: ReactNode;
}) {
  return (
    <div className="text-center">
      <EmptyState hint={hint} icon={icon} title={title} />
      <div className="-mt-4">{cta}</div>
    </div>
  );
}

function OrdersPanel({ orders, loading, error }: { orders: Order[]; loading: boolean; error: string }) {
  const { config } = useSettings();
  const symbol = config?.currencySymbol;

  if (loading) {
    return (
      <div className="flex justify-center py-space-2xl">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-error bg-error-container px-4 py-3 font-body-sm text-on-error-container" role="alert">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <ProfileEmptyState
        cta={
          <Link
            className="inline-flex bg-primary px-space-xl py-space-md text-on-primary rounded-lg font-label-lg hover:bg-primary-container"
            to={routes.shop}
          >
            Start shopping
          </Link>
        }
        hint="When you place an order, its status and details will appear here."
        icon="receipt_long"
        title="No orders yet"
      />
    );
  }

  return (
    <div className="space-y-space-md">
      {orders.map((order) => (
        <Card className="border border-outline-variant/60 p-space-md sm:p-space-lg" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant">Order {order.reference}</p>
              <p className="mt-1 font-body-sm text-body-sm text-outline">
                Placed {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={order.status} />
              <Link
                className="font-label-md text-label-md text-primary hover:underline"
                to={routes.orderSuccess(order.id)}
              >
                View
              </Link>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-outline-variant/50 pt-4">
            {order.items.slice(0, 3).map((item) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={`${order.id}-${item.productId}`}>
                <span className="min-w-0 truncate text-on-surface-variant">
                  {item.quantity} × {item.name}
                </span>
                <span className="shrink-0 text-on-surface">{formatPrice(item.price * item.quantity, symbol)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-outline-variant/50 pt-4">
            <span className="font-label-md text-label-md text-on-surface-variant">Total</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {formatPrice(order.total, symbol)}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SavedPanel() {
  const { items, loading } = useWishlist();

  return (
    <ProductGrid
      className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3"
      empty={
        <ProfileEmptyState
          cta={
            <Link
              className="inline-flex bg-primary px-space-xl py-space-md text-on-primary rounded-lg font-label-lg hover:bg-primary-container"
              to={routes.shop}
            >
              Browse the shop
            </Link>
          }
          hint="Tap the heart on any product to save it for later."
          icon="favorite"
          title="No saved items yet"
        />
      }
      loading={loading}
      products={items}
    />
  );
}

function SettingsPanel() {
  const { profile, user, role, updateProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const tools = accountTools(role);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: trimmedName,
        phone: phone.trim() || null
      });
      setMessage('Profile updated successfully.');
      toast('Profile updated successfully.');
    } catch (err) {
      const text = (err as Error)?.message || 'Could not update your profile.';
      setError(text);
      toast(text, true);
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    void logout().then(() => navigate(routes.home));
  };

  return (
    <div className="space-y-space-lg">
      <Card className="border border-outline-variant/60 p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Personal details</h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Keep your contact details current for order updates and account security.
        </p>
        <form className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={save}>
          <Input
            autoComplete="name"
            id="profile-full-name"
            label="Full name"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
          <Input
            autoComplete="tel"
            id="profile-phone"
            label="Phone number"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+234..."
            type="tel"
            value={phone}
          />
          <Input
            autoComplete="email"
            className="bg-surface-container text-on-surface-variant"
            id="profile-email"
            label="Email address"
            readOnly
            value={user?.email ?? ''}
          />
          <div className="flex items-end sm:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          {message ? (
            <p className="font-body-sm text-body-sm text-primary sm:col-span-2" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="font-body-sm text-body-sm text-error sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="border border-outline-variant/60 p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Account tools</h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {role === 'customer'
            ? 'Ready to share your space with others?'
            : 'Keep your operational tools close by.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tools.map((tool) => (
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 font-label-md text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary"
              key={tool.label}
              to={tool.href}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                {tool.icon}
              </span>
              {tool.label}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="border border-outline-variant/60 p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Account access</h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Sign out of this device when you are finished.
        </p>
        <Button className="mt-5" onClick={signOut} variant="outline">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            logout
          </span>
          Sign out
        </Button>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const { profile, user, role } = useAuth();
  const { items } = useWishlist();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  const activeTab = PROFILE_TABS.some((item) => item.id === tabParam)
    ? (tabParam as ProfileTab)
    : 'orders';
  const name = displayName(profile, user?.email);

  useEffect(() => {
    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError('');
    getMyOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOrdersError((error as Error)?.message || 'Could not load your orders.');
        }
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-space-2xl sm:px-6 lg:px-8">
      <ProfileSummary
        createdAt={profile?.created_at}
        email={user?.email ?? ''}
        name={name}
        orderCount={ordersLoading ? null : orders.length}
        role={role}
        savedCount={items.length}
      />
      <div className="mt-6">
        <ProfileTabs active={activeTab} />
      </div>
      <div className="pt-space-lg">
        {activeTab === 'orders' ? (
          <OrdersPanel error={ordersError} loading={ordersLoading} orders={orders} />
        ) : null}
        {activeTab === 'saved' ? <SavedPanel /> : null}
        {activeTab === 'settings' ? <SettingsPanel /> : null}
      </div>
    </div>
  );
}
