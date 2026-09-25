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
import { Button, Card, Input, Spinner, StatusPill } from '@/ui';
import type { Order, Profile } from '@/types/api';

type ProfileTab = 'orders' | 'saved' | 'settings';

interface ProfileTabItem {
  id: ProfileTab;
  label: string;
  icon: string;
}

const PROFILE_TABS: ProfileTabItem[] = [
  { id: 'orders', label: 'Orders', icon: 'local_shipping' },
  { id: 'saved', label: 'Saved items', icon: 'favorite' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];

function displayName(profile: Profile | null, email: string | null | undefined): string {
  return profile?.full_name?.trim() || email?.split('@')[0] || 'SpaceFit member';
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
    <Card className="mb-6 !rounded-lg border border-outline-variant p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div
              aria-label="Profile photo placeholder"
              className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-outline"
              role="img"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[52px]">
                person
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                {name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-0.5 font-label-md text-label-md text-on-surface-variant">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                  badge
                </span>
                {roleLabel(role)}
              </span>
            </div>
            <p className="mt-1 truncate font-body-md text-body-md text-on-surface-variant">
              {email}
            </p>
            {createdAt ? (
              <div className="mt-1 flex items-center justify-center gap-1 font-body-sm text-body-sm text-on-surface-variant sm:justify-start">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline">
                  calendar_today
                </span>
                <span>Member since {formatDate(createdAt)}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Link
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-5 py-2.5 font-label-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary sm:w-auto"
            to={routes.profileTab('settings')}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              edit
            </span>
            Edit profile
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 border-t border-outline-variant pt-6 sm:grid-cols-3 sm:gap-4">
        <ProfileStat label="Orders" value={orderCount === null ? '—' : String(orderCount)} />
        <ProfileStat label="Saved items" value={String(savedCount)} />
        <ProfileStat label="Account type" value={roleLabel(role)} />
      </div>
    </Card>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded border border-outline-variant bg-surface p-4">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <span className="mt-1 font-headline-lg text-headline-lg font-bold text-on-surface">
        {value}
      </span>
    </div>
  );
}

function ProfileTabs({
  active,
  orderCount,
  savedCount
}: {
  active: ProfileTab;
  orderCount: number | null;
  savedCount: number;
}) {
  return (
    <nav
      aria-label="Profile sections"
      className="mb-6 w-full overflow-x-auto border-b border-outline-variant"
    >
      <div className="flex min-w-max items-center gap-8">
        {PROFILE_TABS.map((item) => {
          const selected = item.id === active;
          const count =
            item.id === 'orders'
              ? orderCount ?? 0
              : item.id === 'saved'
                ? savedCount
                : null;
          return (
            <Link
              aria-current={selected ? 'page' : undefined}
              aria-label={item.label}
              className={[
                'flex items-center gap-2 border-b-2 px-1 py-3 font-label-lg text-label-lg font-semibold transition-colors',
                selected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              ].join(' ')}
              key={item.id}
              to={routes.profileTab(item.id)}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              {item.label}
              {count !== null ? (
                <span
                  aria-hidden="true"
                  className="ml-1 rounded-full bg-surface-container-high px-2 py-0.5 font-label-md text-label-md text-on-surface-variant"
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest p-12 text-center shadow-sm">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-outline">
          {icon}
        </span>
      </div>
      <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
        {title}
      </h2>
      <p className="mt-1 max-w-sm font-body-md text-body-md text-on-surface-variant">{hint}</p>
      <div className="mt-5">{cta}</div>
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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 font-label-lg text-label-lg font-medium text-on-primary transition-opacity hover:opacity-95"
            to={routes.shop}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              shopping_cart
            </span>
            Browse items
          </Link>
        }
        hint="Items you buy will appear here."
        icon="shopping_cart"
        title="No orders yet"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <Card className="!rounded-lg border border-outline-variant p-6 md:p-8" key={order.id}>
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
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 font-label-lg text-label-lg font-medium text-on-primary transition-opacity hover:opacity-95"
              to={routes.shop}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                search
              </span>
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
    <div className="flex flex-col gap-6">
      <Card className="!rounded-lg border border-outline-variant p-6 md:p-8">
        <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          Personal details
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Keep your contact details current for order updates and account security.
        </p>
        <form className="mt-6 space-y-4" onSubmit={save}>
          <Input
            autoComplete="name"
            className="h-12 !rounded-xl"
            id="profile-full-name"
            label="Full name"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
          <Input
            autoComplete="email"
            className="h-12 !rounded-xl bg-surface-container text-on-surface-variant"
            id="profile-email"
            label="Email address"
            readOnly
            value={user?.email ?? ''}
          />
          <Input
            autoComplete="tel"
            className="h-12 !rounded-xl"
            id="profile-phone"
            label="Phone number"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+234 800 000 0000"
            type="tel"
            value={phone}
          />
          <div className="flex justify-end pt-4">
            <Button
              className="min-h-[48px] !rounded-full !px-7 !py-2 font-label-lg text-label-lg"
              disabled={saving}
              type="submit"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          {message ? (
            <p className="font-body-sm text-body-sm text-primary" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="!rounded-lg border border-outline-variant p-6 md:p-8">
        <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          Account tools
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {role === 'customer'
            ? 'Ready to share your space with others?'
            : 'Keep your operational tools close by.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tools.map((tool) => (
            <Link
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-outline-variant px-4 py-2.5 font-label-lg text-label-lg text-on-surface transition-colors hover:border-primary hover:text-primary"
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

      <Card className="!rounded-lg border border-outline-variant p-6 md:p-8">
        <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
          Account access
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Sign out of this device when you are finished.
        </p>
        <Button
          className="mt-5 min-h-[44px] !rounded-md !px-6 !py-2.5 font-label-lg text-label-lg"
          onClick={signOut}
          variant="outline"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
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
    <div className="mx-auto w-full max-w-[1360px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <ProfileSummary
        createdAt={profile?.created_at}
        email={user?.email ?? ''}
        name={name}
        orderCount={ordersLoading ? null : orders.length}
        role={role}
        savedCount={items.length}
      />
      <div>
        <ProfileTabs
          active={activeTab}
          orderCount={ordersLoading ? null : orders.length}
          savedCount={items.length}
        />
      </div>
      <div>
        {activeTab === 'orders' ? (
          <OrdersPanel error={ordersError} loading={ordersLoading} orders={orders} />
        ) : null}
        {activeTab === 'saved' ? <SavedPanel /> : null}
        {activeTab === 'settings' ? <SettingsPanel /> : null}
      </div>
    </div>
  );
}
