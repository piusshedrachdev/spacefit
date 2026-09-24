import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { getMe } from '@/api/auth';
import { getOrders } from '@/api/orders';
import { deleteProduct, getProducts, updateProduct } from '@/api/products';
import { getApplications, getSellers, reviewApplication, setSellerStatus } from '@/api/sellers';
import { getReturns, updateReturnStatus } from '@/api/returns';
import { getSettings, saveSettings } from '@/api/meta';
import { getDevUser, getRole } from '@/lib/session';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Checkbox, Input, Modal, StatusPill, Table, Textarea } from '@/ui';
import type {
  Order,
  Product,
  ReturnRequest,
  ReturnStatus,
  SellerApplication,
  SellerListRow,
  SellerStatus,
  StoreSettings
} from '@/types/api';

/**
 * Admin dashboard — port of legacy admin.html + js/admin.js.
 *
 * Tabs live on the URL (`/admin/:tab`; the legacy `#tab` hash is accepted as
 * an alias so stored notification links like `admin.html#applications` keep
 * resolving). The gate mirrors legacy boot(): a fresh `getMe()` first —
 * `profiles.role` is the source of truth, so a freshly-promoted admin is
 * recognised without a re-login — then `getRole()` with the memory-mode
 * dev-admin bypass; failures render the "Admin access required" shell.
 *
 * Data flow mirrors legacy refresh(): independent labelled fetches (plus the
 * plan's admin-wide Returns tab) where any failure surfaces in the "Some
 * data could not be loaded." banner instead of breaking the tab.
 *
 * Returns is new versus legacy (plan row 6) — ported from the seller
 * dashboard's returns table, scoped admin-wide.
 */

export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'applications', label: 'Applications', icon: 'assignment' },
  { id: 'sellers', label: 'Sellers', icon: 'storefront' },
  { id: 'products', label: 'Products', icon: 'inventory_2' },
  { id: 'orders', label: 'Orders', icon: 'receipt_long' },
  { id: 'returns', label: 'Returns', icon: 'assignment_return' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
] as const;

type AdminTabId = (typeof ADMIN_TABS)[number]['id'];

type Phase = 'loading' | 'denied' | 'ready';

const SIGNED_OUT_MESSAGE =
  'You are not signed in on this page\u2019s origin. Open http://localhost:4000/admin.html and sign in there \u2014 a session saved under file:// or a different port is not visible here.';

const DENIED_CTA_CLASS =
  'inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95';

/* -------------------------------------------------------------- helpers */

function fmtDate(value: string | null | undefined): string {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleString('en-NG');
  } catch {
    return value;
  }
}

/** Legacy label() — one failed fetch becomes a banner entry, not a crash. */
function label<T>(
  fn: () => Promise<T>,
  name: string
): Promise<{ name: string; value?: T; error?: string }> {
  return fn().then(
    (value) => ({ name, value }),
    (err: unknown) => ({ name, error: (err as Error)?.message || 'request failed' })
  );
}

function KpiCard({ stat, value }: { stat: string; value: ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg">
      <p className="font-label-md text-on-surface-variant">{stat}</p>
      <p className="font-headline-md text-headline-md text-on-surface mt-space-xs">
        {value}
      </p>
    </div>
  );
}

/** Legacy detail-modal line: `<label>:` span + value. */
function DetailLine({ label: title, children }: { label: string; children?: ReactNode }) {
  return (
    <p>
      <span className="font-label-md text-on-surface-variant">{title}:</span>{' '}
      {children}
    </p>
  );
}

/** Legacy modal(): Cancel/Confirm footer, close on success, toast on error. */
function ConfirmModal({
  title,
  confirmLabel,
  onClose,
  onConfirm,
  children
}: {
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  children: ReactNode;
}) {
  const { toast } = useToast();

  const confirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      toast((err as Error)?.message || 'Action failed', true);
    }
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-space-lg py-space-sm rounded-lg border border-outline-variant font-label-lg hover:border-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className="px-space-lg py-space-sm rounded-lg bg-primary text-on-primary font-label-lg hover:opacity-95"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

interface ProductEdit {
  price: string;
  availability: string;
  featured: boolean;
}

interface SettingsForm {
  returnPolicy: string;
  sellerPolicy: string;
  deliveryPolicy: string;
  privacyPolicy: string;
  sitewidePercent: string;
  promoCode: string;
  freeDeliveryThreshold: string;
  bannerEnabled: boolean;
}

/* ------------------------------------------------------------------ page */

export function AdminDashboardPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { tab: tabParam } = useParams<{ tab: string }>();
  const location = useLocation();

  const [phase, setPhase] = useState<Phase>('loading');
  const [deniedMessage, setDeniedMessage] = useState('');
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [sellers, setSellers] = useState<SellerListRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const [reviewTarget, setReviewTarget] = useState<SellerApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [sellerTarget, setSellerTarget] = useState<{
    seller: SellerListRow;
    next: SellerStatus;
  } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [productEdits, setProductEdits] = useState<Record<string, ProductEdit>>({});
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    returnPolicy: '',
    sellerPolicy: '',
    deliveryPolicy: '',
    privacyPolicy: '',
    sitewidePercent: '',
    promoCode: '',
    freeDeliveryThreshold: '',
    bannerEnabled: false
  });

  /** Legacy refresh(): independent labelled fetches + failure banner. */
  const refresh = useCallback(async () => {
    const results = await Promise.all([
      label(() => getApplications(), 'applications'),
      label(() => getSellers(), 'sellers'),
      label(() => getProducts({ limit: 200 }), 'products'),
      label(() => getOrders(), 'orders'),
      label(() => getSettings(), 'settings'),
      label(() => getReturns(), 'returns')
    ]);

    const byName: Record<string, unknown> = {};
    const nextFailures: string[] = [];
    for (const result of results) {
      if (result.error) {
        nextFailures.push(`${result.name}: ${result.error}`);
        byName[result.name] = result.name === 'settings' ? null : [];
      } else {
        byName[result.name] = result.value;
      }
    }
    setApplications(
      Array.isArray(byName.applications) ? (byName.applications as SellerApplication[]) : []
    );
    setSellers(Array.isArray(byName.sellers) ? (byName.sellers as SellerListRow[]) : []);
    setProducts(Array.isArray(byName.products) ? (byName.products as Product[]) : []);
    setOrders(Array.isArray(byName.orders) ? (byName.orders as Order[]) : []);
    setReturnsList(Array.isArray(byName.returns) ? (byName.returns as ReturnRequest[]) : []);
    setSettings((byName.settings as StoreSettings | null | undefined) || null);
    setFailures(nextFailures);
  }, []);

  /** Boot gate — legacy boot(): fresh getMe(), then role + dev-admin bypass. */
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setDeniedMessage(SIGNED_OUT_MESSAGE);
      setPhase('denied');
      return;
    }

    setPhase('loading');
    void (async () => {
      // Always refresh the profile first: `profiles.role` is the source of
      // truth, so a freshly-promoted admin is recognised without a re-login.
      try {
        await getMe();
      } catch (err) {
        if (!cancelled) {
          setDeniedMessage(
            `Could not load your profile (${(err as Error)?.message || 'Could not load your profile'}). Your session may have expired \u2014 please sign in again.`
          );
          setPhase('denied');
        }
        return;
      }
      if (cancelled) return;

      const role = getRole();
      const devAdmin = getDevUser() === 'dev-user-admin';
      if (role !== 'admin' && !devAdmin) {
        setDeniedMessage(
          `Your account role is "${role}". An administrator account is required.`
        );
        setPhase('denied');
        return;
      }

      setPhase('ready');
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refresh]);

  /** Inline product edits re-seed whenever the rows reload (legacy re-render). */
  useEffect(() => {
    const next: Record<string, ProductEdit> = {};
    for (const item of products) {
      next[item.id] = {
        price: String(item.price || 0),
        availability: item.availability || '',
        featured: item.featured
      };
    }
    setProductEdits(next);
  }, [products]);

  /** Settings form mirrors state.settings (legacy re-render on refresh). */
  useEffect(() => {
    if (!settings) return;
    const p = settings.policies;
    const d = settings.discounts;
    setSettingsForm({
      returnPolicy: p.returnPolicy || '',
      sellerPolicy: p.sellerPolicy || '',
      deliveryPolicy: p.deliveryPolicy || '',
      privacyPolicy: p.privacyPolicy || '',
      sitewidePercent: d.sitewidePercent == null ? '' : String(d.sitewidePercent),
      promoCode: d.promoCode || '',
      freeDeliveryThreshold:
        d.freeDeliveryThreshold == null ? '' : String(d.freeDeliveryThreshold),
      bannerEnabled: Boolean(d.bannerEnabled)
    });
  }, [settings]);

  /* ------------------------------------------------------------- actions */

  const openApplication = (app: SellerApplication) => {
    setReviewTarget(app);
    setReviewNotes('');
  };

  const decide = async (decision: 'approved' | 'rejected') => {
    const app = reviewTarget;
    if (!app) return;
    try {
      await reviewApplication(app.id, decision, reviewNotes.trim() || undefined);
      toast(`Application ${decision}.`);
      setReviewTarget(null);
      setReviewNotes('');
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Could not update application', true);
    }
  };

  const openSellerStatus = (seller: SellerListRow) => {
    setSellerTarget({
      seller,
      next: seller.status === 'blocked' ? 'active' : 'blocked'
    });
    setBlockReason('');
  };

  const changeSellerStatus = async () => {
    if (!sellerTarget) return;
    const { seller, next } = sellerTarget;
    await setSellerStatus(seller.id, next, blockReason.trim() || undefined);
    toast(`Seller ${next === 'blocked' ? 'blocked' : 'unblocked'}.`);
    await refresh();
  };

  const patchEdit = (item: Product, key: keyof ProductEdit, value: string | boolean) =>
    setProductEdits((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? {
          price: String(item.price || 0),
          availability: item.availability || '',
          featured: item.featured
        }),
        [key]: value
      }
    }));

  const saveRow = async (item: Product) => {
    const edit = productEdits[item.id] ?? {
      price: String(item.price || 0),
      availability: item.availability || '',
      featured: item.featured
    };
    try {
      await updateProduct(item.id, {
        price: Number(edit.price),
        availability: edit.availability.trim(),
        featured: edit.featured
      });
      toast('Product updated.');
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Update failed', true);
    }
  };

  const removeProduct = async (product: Product) => {
    await deleteProduct(product.id);
    toast('Product deleted.');
    await refresh();
  };

  const actReturn = async (id: string, status: ReturnStatus) => {
    try {
      await updateReturnStatus(id, status);
      toast(`Return ${status}.`);
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Update failed', true);
    }
  };

  const saveSettingsForm = async () => {
    try {
      const data = await saveSettings({
        policies: {
          returnPolicy: settingsForm.returnPolicy,
          sellerPolicy: settingsForm.sellerPolicy,
          deliveryPolicy: settingsForm.deliveryPolicy,
          privacyPolicy: settingsForm.privacyPolicy
        },
        discounts: {
          sitewidePercent: Number(settingsForm.sitewidePercent) || 0,
          promoCode: settingsForm.promoCode.trim(),
          freeDeliveryThreshold: Number(settingsForm.freeDeliveryThreshold) || 0,
          bannerEnabled: settingsForm.bannerEnabled
        }
      });
      setSettings(data);
      toast('Settings saved.');
    } catch (err) {
      toast((err as Error)?.message || 'Could not save settings', true);
    }
  };

  const patchSettings =
    (key: Exclude<keyof SettingsForm, 'bannerEnabled'>) =>
    (event: { target: { value: string } }) =>
      setSettingsForm((current) => ({ ...current, [key]: event.target.value }));

  /* ---------------------------------------------------------------- gates */

  if (phase === 'loading') {
    // Material icon (not <Spinner/>) — the toast host owns role="status".
    return (
      <div className="text-center py-space-2xl text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
        <p className="mt-space-sm font-body-sm">{'Loading dashboard\u2026'}</p>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">
        <span
          className="material-symbols-outlined text-5xl text-error"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          lock
        </span>
        <h1 className="font-headline-lg text-headline-lg mt-space-md">
          Admin access required
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">
          {deniedMessage}
        </p>
        <Link
          className={DENIED_CTA_CLASS}
          to={`${routes.auth}?next=${encodeURIComponent(routes.admin)}`}
        >
          Sign in
        </Link>
      </div>
    );
  }

  /* --------------------------------------------------------------- shell */

  // Tab from the path, falling back to the legacy hash alias; unknown → overview.
  const hashTab = location.hash.replace('#', '');
  const requested =
    tabParam ?? (ADMIN_TABS.some((t) => t.id === hashTab) ? hashTab : undefined);
  const tab: AdminTabId = ADMIN_TABS.some((t) => t.id === requested)
    ? (requested as AdminTabId)
    : 'overview';

  const renderOverview = () => {
    const pending = applications.filter((a) => a.status === 'pending').length;
    const revenue = orders.reduce((n, o) => n + (o.total || 0), 0);

    return (
      <>
        <h1 className="font-headline-lg text-headline-lg mb-space-md">Overview</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          <KpiCard stat="Pending applications" value={String(pending)} />
          <KpiCard stat="Sellers" value={String(sellers.length)} />
          <KpiCard stat="Products" value={String(products.length)} />
          <KpiCard stat="Orders" value={String(orders.length)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mt-space-md">
          <KpiCard stat="Recorded revenue" value={formatPrice(revenue)} />
          <KpiCard
            stat="Blocked sellers"
            value={String(sellers.filter((s) => s.status === 'blocked').length)}
          />
        </div>
        <div className="mt-space-lg">
          <h2 className="font-headline-sm mb-space-sm">Latest applications</h2>
          <div className="bg-surface rounded-xl border border-outline-variant/60">
            <Table
              columns={[
                { key: 'shop', header: 'Shop', render: (a) => a.shopName },
                { key: 'applicant', header: 'Applicant', render: (a) => a.fullName },
                {
                  key: 'status',
                  header: 'Status',
                  render: (a) => <StatusPill status={a.status} />
                },
                {
                  key: 'submitted',
                  header: 'Submitted',
                  render: (a) => fmtDate(a.createdAt)
                }
              ]}
              rows={applications.slice(0, 5)}
              rowKey={(a) => a.id}
              empty="No applications yet."
            />
          </div>
        </div>
      </>
    );
  };

  const renderApplications = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Applications</h1>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            { key: 'shop', header: 'Shop', render: (a) => a.shopName },
            {
              key: 'applicant',
              header: 'Applicant',
              render: (a) => (
                <>
                  {a.fullName}
                  <br />
                  <span className="text-on-surface-variant">{a.email}</span>
                </>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (a) => <StatusPill status={a.status} />
            },
            {
              key: 'submitted',
              header: 'Submitted',
              render: (a) => fmtDate(a.createdAt)
            },
            {
              key: 'actions',
              header: '',
              render: (a) => (
                <button
                  type="button"
                  onClick={() => openApplication(a)}
                  className="text-primary font-label-md hover:underline"
                >
                  Review
                </button>
              )
            }
          ]}
          rows={applications}
          rowKey={(a) => a.id}
          empty="No applications."
        />
      </div>
    </>
  );

  const renderSellers = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Sellers</h1>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            { key: 'shop', header: 'Shop', render: (s) => s.shopName },
            {
              key: 'status',
              header: 'Status',
              render: (s) => <StatusPill status={s.status} />
            },
            { key: 'products', header: 'Products', render: (s) => String(s.products || 0) },
            {
              key: 'joined',
              header: 'Joined',
              render: (s) => fmtDate(s.createdAt)
            },
            {
              key: 'actions',
              header: '',
              render: (s) => (
                <button
                  type="button"
                  onClick={() => openSellerStatus(s)}
                  className={[
                    'font-label-md hover:underline',
                    s.status === 'blocked' ? 'text-primary' : 'text-error'
                  ].join(' ')}
                >
                  {s.status === 'blocked' ? 'Unblock' : 'Block'}
                </button>
              )
            }
          ]}
          rows={sellers}
          rowKey={(s) => s.id}
          empty="No sellers."
        />
      </div>
    </>
  );

  const renderProducts = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Products</h1>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (p) => (
                <>
                  {p.title}
                  <br />
                  <span className="text-on-surface-variant">{p.category}</span>
                </>
              )
            },
            {
              key: 'price',
              header: 'Price',
              render: (p) => (
                <input
                  type="number"
                  value={productEdits[p.id]?.price ?? String(p.price || 0)}
                  onChange={(event) => patchEdit(p, 'price', event.target.value)}
                  aria-label={`Price for ${p.title}`}
                  className="w-28 text-sm border border-outline-variant rounded-lg px-2 py-1"
                />
              )
            },
            {
              key: 'availability',
              header: 'Availability',
              render: (p) => (
                <input
                  type="text"
                  value={productEdits[p.id]?.availability ?? p.availability ?? ''}
                  onChange={(event) => patchEdit(p, 'availability', event.target.value)}
                  aria-label={`Availability for ${p.title}`}
                  className="w-32 text-sm border border-outline-variant rounded-lg px-2 py-1"
                />
              )
            },
            {
              key: 'featured',
              header: 'Featured',
              render: (p) => (
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={productEdits[p.id]?.featured ?? p.featured}
                    onChange={(event) => patchEdit(p, 'featured', event.target.checked)}
                    aria-label={`Featured: ${p.title}`}
                  />{' '}
                  Featured
                </label>
              )
            },
            {
              key: 'actions',
              header: '',
              render: (p) => (
                <>
                  <button
                    type="button"
                    onClick={() => void saveRow(p)}
                    className="text-primary font-label-md hover:underline mr-space-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    className="text-error font-label-md hover:underline"
                  >
                    Delete
                  </button>
                </>
              )
            }
          ]}
          rows={products}
          rowKey={(p) => p.id}
          empty="No products."
        />
      </div>
    </>
  );

  const renderOrders = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Orders</h1>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            { key: 'reference', header: 'Reference', render: (o) => o.reference || o.id },
            {
              key: 'customer',
              header: 'Customer',
              render: (o) => o.customer?.fullName || '\u2014'
            },
            {
              key: 'status',
              header: 'Status',
              render: (o) => <StatusPill status={o.status} />
            },
            { key: 'total', header: 'Total', render: (o) => formatPrice(o.total || 0) },
            { key: 'placed', header: 'Placed', render: (o) => fmtDate(o.createdAt) }
          ]}
          rows={orders}
          rowKey={(o) => o.id}
          empty="No orders."
        />
      </div>
    </>
  );

  const renderReturns = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Returns</h1>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (row) => row.productTitle || row.productId || ''
            },
            { key: 'reason', header: 'Reason', render: (row) => row.reason },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusPill status={row.status} />
            },
            {
              key: 'requested',
              header: 'Requested',
              render: (row) => fmtDate(row.createdAt)
            },
            {
              key: 'actions',
              header: '',
              render: (row) =>
                row.status === 'requested' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void actReturn(row.id, 'approved')}
                      className="text-primary font-label-md hover:underline mr-space-sm"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void actReturn(row.id, 'rejected')}
                      className="text-error font-label-md hover:underline"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="text-on-surface-variant">{row.status}</span>
                )
            }
          ]}
          rows={returnsList}
          rowKey={(row) => row.id}
          empty="No return requests."
        />
      </div>
    </>
  );

  const renderSettings = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <section className="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">
          <h2 className="font-headline-sm">Policies</h2>
          <Textarea
            label="Return policy"
            id="policyReturn"
            rows={3}
            value={settingsForm.returnPolicy}
            onChange={patchSettings('returnPolicy')}
          />
          <Textarea
            label="Seller policy"
            id="policySeller"
            rows={3}
            value={settingsForm.sellerPolicy}
            onChange={patchSettings('sellerPolicy')}
          />
          <Textarea
            label="Delivery policy"
            id="policyDelivery"
            rows={3}
            value={settingsForm.deliveryPolicy}
            onChange={patchSettings('deliveryPolicy')}
          />
          <Textarea
            label="Privacy policy"
            id="policyPrivacy"
            rows={3}
            value={settingsForm.privacyPolicy}
            onChange={patchSettings('privacyPolicy')}
          />
        </section>
        <section className="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">
          <h2 className="font-headline-sm">Discounts</h2>
          <Input
            label="Sitewide discount (%)"
            id="discountPercent"
            type="number"
            value={settingsForm.sitewidePercent}
            onChange={patchSettings('sitewidePercent')}
          />
          <Input
            label="Promo code"
            id="discountCode"
            value={settingsForm.promoCode}
            onChange={patchSettings('promoCode')}
          />
          <Input
            label="Free-delivery threshold"
            id="discountThreshold"
            type="number"
            value={settingsForm.freeDeliveryThreshold}
            onChange={patchSettings('freeDeliveryThreshold')}
          />
          <Checkbox
            id="discountBanner"
            checked={settingsForm.bannerEnabled}
            onChange={(event) =>
              setSettingsForm((current) => ({
                ...current,
                bannerEnabled: event.target.checked
              }))
            }
            label="Show discount banner"
          />
        </section>
      </div>
      <div className="mt-space-lg flex justify-end">
        <button
          type="button"
          id="saveSettings"
          onClick={() => void saveSettingsForm()}
          className="bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95"
        >
          Save settings
        </button>
      </div>
    </>
  );

  const app = reviewTarget;

  return (
    <div className="flex flex-col lg:flex-row gap-space-lg">
      <aside className="lg:w-56 shrink-0">
        <nav className="flex lg:flex-col gap-space-xs overflow-x-auto bg-surface rounded-xl border border-outline-variant/60 p-space-sm">
          {ADMIN_TABS.map((item) => {
            const active = item.id === tab;
            const className = [
              'flex items-center gap-space-sm px-space-md py-space-sm rounded-lg font-label-lg whitespace-nowrap hover:bg-surface-container-high',
              active ? 'bg-primary text-on-primary' : ''
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Link
                key={item.id}
                to={item.id === 'overview' ? routes.admin : `${routes.admin}/${item.id}`}
                className={className}
                aria-current={active ? 'page' : undefined}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="flex-1 min-w-0">
        {failures.length ? (
          <div className="mb-space-md rounded-xl border border-error/40 bg-error-container text-on-error-container p-space-md font-body-sm">
            <strong>Some data could not be loaded.</strong>{' '}
            {failures.join('  \u00b7  ')}
            {
              '  \u2014  make sure you are signed in as an admin and that the API is running.'
            }
          </div>
        ) : null}

        {tab === 'overview'
          ? renderOverview()
          : tab === 'applications'
            ? renderApplications()
            : tab === 'sellers'
              ? renderSellers()
              : tab === 'products'
                ? renderProducts()
                : tab === 'orders'
                  ? renderOrders()
                  : tab === 'returns'
                    ? renderReturns()
                    : renderSettings()}
      </section>

      {app ? (
        <Modal
          open
          wide
          title={app.shopName}
          onClose={() => {
            setReviewTarget(null);
            setReviewNotes('');
          }}
        >
          <div className="space-y-space-md">
            <div className="space-y-space-sm">
              <DetailLine label="Applicant">
                {app.fullName}{' ('}
                {app.email}{')'}
              </DetailLine>
              <DetailLine label="Phone">{app.phone}</DetailLine>
              <DetailLine label="Location">
                {(app.location
                  ? `${app.location.city}, ${app.location.state}`
                  : '') || '\u2014'}
              </DetailLine>
              <DetailLine label="Delivery places">
                {(app.deliveryPlaces || []).join(', ') || '\u2014'}
              </DetailLine>
              <DetailLine label="Categories">
                {(app.categories || []).join(', ') || '\u2014'}
              </DetailLine>
              {app.bio ? <DetailLine label="Bio">{app.bio}</DetailLine> : null}
              <DetailLine label="Terms accepted">
                {app.termsAccepted ? 'Yes' : 'No'}
              </DetailLine>
              <DetailLine label="Disclaimers accepted">
                {app.disclaimersAccepted ? 'Yes' : 'No'}
              </DetailLine>
              {app.reviewNotes ? (
                <DetailLine label="Previous notes">{app.reviewNotes}</DetailLine>
              ) : null}
            </div>
            {app.status === 'pending' ? (
              <>
                <Textarea
                  label="Review notes (optional)"
                  id="reviewNotes"
                  rows={2}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                />
                <div className="flex gap-space-sm">
                  <button
                    type="button"
                    onClick={() => void decide('approved')}
                    className="flex-1 bg-primary text-on-primary py-space-sm rounded-lg font-label-lg hover:opacity-95"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide('rejected')}
                    className="flex-1 border border-error text-error py-space-sm rounded-lg font-label-lg hover:bg-error-container"
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <p className="font-body-sm text-on-surface-variant">
                This application has already been {app.status}.
              </p>
            )}
          </div>
        </Modal>
      ) : null}

      {sellerTarget ? (
        <ConfirmModal
          title={`${sellerTarget.next === 'blocked' ? 'Block' : 'Unblock'} ${sellerTarget.seller.shopName}?`}
          confirmLabel={
            sellerTarget.next === 'blocked' ? 'Block seller' : 'Unblock seller'
          }
          onClose={() => {
            setSellerTarget(null);
            setBlockReason('');
          }}
          onConfirm={changeSellerStatus}
        >
          <div className="space-y-space-md">
            <p className="font-body-sm text-on-surface-variant">
              {sellerTarget.next === 'blocked'
                ? 'The seller\u2019s listings will be hidden from the storefront and they will be notified.'
                : 'The seller will regain access and their listings will be visible again.'}
            </p>
            <input
              id="blockReason"
              className="w-full text-sm border border-outline-variant rounded-lg px-3 py-2"
              placeholder="Reason (optional)"
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
            />
          </div>
        </ConfirmModal>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Delete product?"
          confirmLabel="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => removeProduct(deleteTarget)}
        >
          <p className="font-body-sm text-on-surface-variant">
            {deleteTarget.title} will be permanently removed.
          </p>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
