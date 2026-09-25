import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthProvider';
import { useNotifications } from '@/context/NotificationsProvider';
import { useToast } from '@/context/ToastProvider';
import {
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  updateProduct
} from '@/api/products';
import { getNotifications } from '@/api/notifications';
import { getMySellerContext, getSellerDashboard, updateMySellerProfile } from '@/api/sellers';
import { getReturns, updateReturnStatus } from '@/api/returns';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import {
  Checkbox,
  Input,
  Modal,
  RatingStars,
  Select,
  StatusPill,
  Table,
  Textarea
} from '@/ui';
import type {
  AppNotification,
  CategoryCount,
  NotificationsPage,
  Product,
  ProductReview,
  ProductWritePayload,
  ReturnRequest,
  ReturnStatus,
  SellerApplication,
  SellerContext,
  SellerDashboard,
  SellerStats
} from '@/types/api';

/**
 * Seller dashboard — port of legacy seller-dashboard.html + js/seller-dashboard.js.
 *
 * Tabs live on the URL (`/seller-dashboard/:tab`; the legacy `#tab` hash is
 * accepted as an alias so stored links keep resolving) and the four gates
 * from the plan render in place of the shell: signed out → branded sign-in
 * prompt, pending application → "under review", blocked seller → contact
 * support, approved seller → the dashboard itself.
 *
 * Data flow mirrors legacy refresh(): dashboard / returns / notifications
 * load independently and any failure surfaces in the "Some data could not
 * be loaded." banner instead of breaking the tab. Product rows come from
 * getProducts (the dashboard aggregation has no rows) and are re-fetched
 * after every CRUD mutation.
 */

export const SELLER_TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'products', label: 'My Products', icon: 'inventory_2' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'returns', label: 'Returns', icon: 'assignment_return' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'profile', label: 'Shop profile', icon: 'storefront' }
] as const;

type SellerTabId = (typeof SELLER_TABS)[number]['id'];

type Phase =
  | 'loading'
  | 'signed-out'
  | 'context-error'
  | 'pending'
  | 'rejected'
  | 'apply'
  | 'blocked'
  | 'ready';

const GATE_CTA_CLASS =
  'inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95';

const MAX_PRODUCT_IMAGES = 8;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif';

interface ProductForm {
  title: string;
  category: string;
  price: string;
  origPrice: string;
  availability: string;
  featured: boolean;
  shortDescription: string;
  description: string;
  features: string;
  sizes: string;
  images: File[];
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  title: '',
  category: 'Uncategorised',
  price: '',
  origPrice: '',
  availability: 'In stock',
  featured: false,
  shortDescription: '',
  description: '',
  features: '',
  sizes: '',
  images: []
};

/* -------------------------------------------------------------- helpers */

function fmtDate(value: string | null | undefined): string {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleString('en-NG');
  } catch {
    return value;
  }
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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

function GateShell({
  title,
  icon,
  tone,
  children,
  cta
}: {
  title: string;
  icon: string;
  tone: string;
  children: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="max-w-lg mx-auto text-center bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl">
      <span
        className={`material-symbols-outlined text-5xl ${tone}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <h1 className="font-headline-lg text-headline-lg mt-space-md">{title}</h1>
      <div className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm">
        {children}
      </div>
      {cta ? <div className="mt-space-lg">{cta}</div> : null}
    </div>
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

/* ------------------------------------------------------------------ page */

export function SellerDashboardPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { markRead: providerMarkRead, markAllRead: providerMarkAllRead } =
    useNotifications();
  const { tab: tabParam } = useParams<{ tab: string }>();
  const location = useLocation();

  const [phase, setPhase] = useState<Phase>('loading');
  const [context, setContext] = useState<SellerContext | null>(null);
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [contextError, setContextError] = useState('');
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [failures, setFailures] = useState<string[]>([]);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [profileForm, setProfileForm] = useState({
    shopName: '',
    bio: '',
    places: ''
  });

  const seller = context?.seller ?? null;

  /** Full product rows (the dashboard aggregation carries stats only). */
  const loadProducts = useCallback(async (sellerId?: string | null) => {
    if (!sellerId) return [];
    try {
      const items = await getProducts({ sellerId, limit: 200 });
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, []);

  /** Legacy refresh(): independent labelled fetches + failure banner. */
  const refresh = useCallback(async () => {
    const results = await Promise.all([
      label(() => getSellerDashboard(), 'dashboard'),
      label(() => getReturns(), 'returns'),
      label(() => getNotifications(30), 'notifications')
    ]);

    const nextFailures: string[] = [];
    for (const result of results) {
      if (result.error) {
        nextFailures.push(`${result.name}: ${result.error}`);
        continue;
      }
      if (result.name === 'dashboard') {
        const dashboard = result.value as SellerDashboard;
        setStats(dashboard.stats ?? null);
        setReviews(dashboard.reviews ?? []);
        if (dashboard.seller) {
          setContext((current) =>
            current ? { ...current, seller: dashboard.seller } : current
          );
        }
      } else if (result.name === 'returns') {
        setReturnsList(Array.isArray(result.value) ? (result.value as ReturnRequest[]) : []);
      } else if (result.name === 'notifications') {
        setNotifications((result.value as NotificationsPage | undefined)?.items ?? []);
      }
    }
    setFailures(nextFailures);
  }, []);

  /** Boot: gate first (legacy boot()), then products + categories + refresh. */
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setPhase('signed-out');
      return;
    }

    setPhase('loading');
    void (async () => {
      let ctx: SellerContext;
      try {
        ctx = await getMySellerContext();
      } catch (err) {
        if (!cancelled) {
          setContextError(
            (err as Error)?.message || 'Could not load your seller profile'
          );
          setPhase('context-error');
        }
        return;
      }
      if (cancelled) return;

      setContext(ctx);
      setApplication(ctx.application);

      if (!ctx.isSeller) {
        const app = ctx.application;
        setPhase(
          app?.status === 'pending'
            ? 'pending'
            : app?.status === 'rejected'
              ? 'rejected'
              : 'apply'
        );
        return;
      }
      if (ctx.seller?.status === 'blocked') {
        setPhase('blocked');
        return;
      }

      const [items, categoryList] = await Promise.all([
        loadProducts(ctx.seller?.id),
        getCategories().catch(() => [] as CategoryCount[])
      ]);
      if (cancelled) return;
      setProducts(items);
      setCategories(categoryList);
      setPhase('ready');
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadProducts, refresh]);

  /** Keep the profile form in sync with the stored seller (legacy re-render). */
  useEffect(() => {
    if (!seller) return;
    setProfileForm({
      shopName: seller.shopName || '',
      bio: seller.bio || '',
      places: (seller.deliveryPlaces || []).join('\n')
    });
  }, [seller]);

  /* ------------------------------------------------------------- actions */

  const reloadAfterMutation = useCallback(async () => {
    const items = await loadProducts(seller?.id);
    setProducts(items);
    await refresh();
  }, [loadProducts, refresh, seller?.id]);

  const openAddProduct = () => {
    setModalProduct(null);
    setProductForm({
      ...EMPTY_PRODUCT_FORM,
      images: [],
      category: categories[0]?.name || 'Uncategorised'
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setModalProduct(product);
    setProductForm({
      title: product.title,
      category: product.category,
      price: String(product.price),
      origPrice: product.origPrice ? String(product.origPrice) : '',
      availability: product.availability,
      featured: product.featured,
      shortDescription: product.shortDescription,
      description: product.description,
      features: (product.features || []).join('\n'),
      sizes: (product.sizes || []).join('\n'),
      // Existing images stay on the server unless the seller selects new
      // replacement files below.
      images: []
    });
    setProductModalOpen(true);
  };

  /** Modal confirm — throws for the legacy validation toasts. */
  const saveProduct = async () => {
    const title = productForm.title.trim();
    if (title.length < 2) throw new Error('Enter a product title.');
    const price = Number(productForm.price);
    if (Number.isNaN(price) || price < 0) throw new Error('Enter a valid price.');

    const payload: ProductWritePayload = {
      title,
      category: productForm.category,
      price,
      origPrice: productForm.origPrice ? Number(productForm.origPrice) : undefined,
      availability: productForm.availability.trim(),
      shortDescription: productForm.shortDescription.trim(),
      description: productForm.description.trim(),
      features: linesToList(productForm.features),
      sizes: linesToList(productForm.sizes),
      images: productForm.images,
      featured: productForm.featured
    };

    if (modalProduct) {
      await updateProduct(modalProduct.id, payload);
      toast('Product updated.');
    } else {
      await createProduct(payload);
      toast('Product added.');
    }
    await reloadAfterMutation();
  };

  const removeProduct = async (product: Product) => {
    await deleteProduct(product.id);
    toast('Product deleted.');
    await reloadAfterMutation();
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

  const onMarkRead = async (id: string) => {
    try {
      await providerMarkRead(id);
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Failed', true);
    }
  };

  const onMarkAllRead = async () => {
    try {
      await providerMarkAllRead();
      toast('All caught up.');
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Failed', true);
    }
  };

  const saveProfile = async () => {
    const shopName = profileForm.shopName.trim();
    if (shopName.length < 2) {
      toast('Enter a shop name.', true);
      return;
    }
    try {
      await updateMySellerProfile({
        shopName,
        bio: profileForm.bio.trim(),
        deliveryPlaces: linesToList(profileForm.places)
      });
      toast('Shop profile saved.');
      await refresh();
    } catch (err) {
      toast((err as Error)?.message || 'Could not save profile', true);
    }
  };

  const onProductImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const invalid = selected.find(
      (file) =>
        !PRODUCT_IMAGE_ACCEPT.split(',').includes(file.type) ||
        file.size === 0 ||
        file.size > MAX_PRODUCT_IMAGE_BYTES
    );
    if (invalid) {
      toast(
        invalid.size === 0
          ? 'Product images cannot be empty.'
          : invalid.size > MAX_PRODUCT_IMAGE_BYTES
            ? 'Each product image must be 5 MB or smaller.'
            : 'Choose a PNG, JPEG, WebP, AVIF, or GIF image.',
        true
      );
      event.target.value = '';
      return;
    }
    if (productForm.images.length + selected.length > MAX_PRODUCT_IMAGES) {
      toast(`Upload at most ${MAX_PRODUCT_IMAGES} product images.`, true);
      event.target.value = '';
      return;
    }
    setProductForm((current) => ({
      ...current,
      images: [...current.images, ...selected]
    }));
    // Allow selecting the same file again after removing it from the selection.
    event.target.value = '';
  };

  const patchProductForm =
    (key: Exclude<keyof ProductForm, 'featured' | 'images'>) =>
    (event: { target: { value: string } }) =>
      setProductForm((current) => ({ ...current, [key]: event.target.value }));

  /* ---------------------------------------------------------------- gates */

  if (phase === 'loading') {
    // Material icon (not <Spinner/>) — the toast host owns role="status".
    return (
      <div className="text-center py-space-2xl text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
      </div>
    );
  }

  if (phase === 'signed-out') {
    return (
      <GateShell
        title="Sign in to sell on SpaceFit"
        icon="storefront"
        tone="text-primary"
        cta={
          <Link
            className={GATE_CTA_CLASS}
            to={`${routes.auth}?next=${encodeURIComponent(routes.sellerDashboard)}`}
          >
            Sign in
          </Link>
        }
      >
        <p>Open your seller dashboard to manage listings, orders, reviews and returns.</p>
      </GateShell>
    );
  }

  if (phase === 'context-error') {
    return (
      <GateShell title="Could not load your profile" icon="error" tone="text-error">
        <p>{contextError}</p>
      </GateShell>
    );
  }

  if (phase === 'pending') {
    return (
      <GateShell
        title="Application under review"
        icon="hourglass_top"
        tone="text-secondary"
      >
        <p>
          Your application for <strong>{application?.shopName}</strong> is being
          reviewed. We{'\u2019'}ll be in touch within {'2\u20133'} business days.
        </p>
      </GateShell>
    );
  }

  if (phase === 'rejected') {
    return (
      <GateShell
        title="Application not approved"
        icon="cancel"
        tone="text-error"
        cta={
          <Link className={GATE_CTA_CLASS} to={routes.sellerApply}>
            Reapply
          </Link>
        }
      >
        <p>Your application was not approved.</p>
        {application?.reviewNotes ? (
          <p className="mt-space-sm">Reviewer note: {application.reviewNotes}</p>
        ) : null}
      </GateShell>
    );
  }

  if (phase === 'apply') {
    return (
      <GateShell
        title="Become a SpaceFit seller"
        icon="storefront"
        tone="text-primary"
        cta={
          <Link className={GATE_CTA_CLASS} to={routes.sellerApply}>
            Apply to sell
          </Link>
        }
      >
        <p>Apply to start selling your pieces on SpaceFit.</p>
      </GateShell>
    );
  }

  if (phase === 'blocked') {
    return (
      <GateShell
        title="Seller account suspended"
        icon="block"
        tone="text-error"
      >
        <p>
          Your seller account is currently suspended. Please contact
          support@spacefit.ng for assistance.
        </p>
      </GateShell>
    );
  }

  /* --------------------------------------------------------------- shell */

  // Tab from the path, falling back to the legacy hash alias; unknown → overview.
  const hashTab = location.hash.replace('#', '');
  const requested =
    tabParam ?? (SELLER_TABS.some((t) => t.id === hashTab) ? hashTab : undefined);
  const tab: SellerTabId = SELLER_TABS.some((t) => t.id === requested)
    ? (requested as SellerTabId)
    : 'overview';

  const renderOverview = () => {
    const s: Partial<SellerStats> = stats ?? {};
    const ret = s.returns ?? { total: 0, requested: 0, approved: 0, rejected: 0, completed: 0 };
    const orders = s.recentOrders ?? [];

    return (
      <>
        <h1 className="font-headline-lg text-headline-lg mb-space-md">
          {seller?.shopName || 'Your shop'}
        </h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-space-md">
          <KpiCard stat="Products listed" value={String(s.products || 0)} />
          <KpiCard stat="Units sold" value={String(s.unitsSold || 0)} />
          <KpiCard stat="Revenue" value={formatPrice(s.revenue || 0)} />
          <KpiCard
            stat="Avg rating"
            value={
              <>
                {s.avgRating || 0}{' '}
                <RatingStars rating={Number(s.avgRating) || 0} />
              </>
            }
          />
          <KpiCard stat="Reviews" value={String(s.reviewsCount || 0)} />
          <KpiCard
            stat="Returns"
            value={
              <>
                {ret.total || 0}
                {ret.requested ? (
                  <span className="text-secondary text-body-sm">
                    {' ('}
                    {ret.requested}
                    {' open)'}
                  </span>
                ) : null}
              </>
            }
          />
        </div>
        <div className="mt-space-lg">
          <h2 className="font-headline-sm mb-space-sm">Recent orders</h2>
          <div className="bg-surface rounded-xl border border-outline-variant/60">
            <Table
              columns={[
                {
                  key: 'reference',
                  header: 'Reference',
                  render: (order) => order.reference || order.id
                },
                { key: 'status', header: 'Status', render: (order) => order.status },
                { key: 'units', header: 'Units', render: (order) => String(order.units) },
                {
                  key: 'value',
                  header: 'Value',
                  render: (order) => formatPrice(order.value)
                },
                {
                  key: 'placed',
                  header: 'Placed',
                  render: (order) => fmtDate(order.createdAt)
                }
              ]}
              rows={orders}
              rowKey={(order) => order.id}
              empty="No orders yet."
            />
          </div>
        </div>
      </>
    );
  };

  const renderProducts = () => (
    <>
      <div className="flex items-center justify-between mb-space-md">
        <h1 className="font-headline-lg text-headline-lg">My Products</h1>
        <button
          type="button"
          id="addProduct"
          onClick={openAddProduct}
          className="bg-primary text-on-primary px-space-lg py-space-sm rounded-lg font-label-lg hover:opacity-95"
        >
          Add product
        </button>
      </div>
      <div className="bg-surface rounded-xl border border-outline-variant/60">
        <Table
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (product) => (
                <>
                  {product.title}
                  <br />
                  <span className="text-on-surface-variant">{product.category}</span>
                </>
              )
            },
            {
              key: 'price',
              header: 'Price',
              render: (product) => formatPrice(product.price)
            },
            {
              key: 'availability',
              header: 'Availability',
              render: (product) => (
                <>
                  {product.availability || ''}
                  {product.featured ? (
                    <>
                      {' \u00b7 '}
                      <span className="text-primary">Featured</span>
                    </>
                  ) : null}
                </>
              )
            },
            {
              key: 'reviews',
              header: 'Reviews',
              render: (product) => (
                <>
                  {product.reviews || 0} @ {product.rating || 0}
                </>
              )
            },
            {
              key: 'actions',
              header: '',
              render: (product) => (
                <>
                  <button
                    type="button"
                    onClick={() => openEditProduct(product)}
                    className="text-primary font-label-md hover:underline mr-space-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(product)}
                    className="text-error font-label-md hover:underline"
                  >
                    Delete
                  </button>
                </>
              )
            }
          ]}
          rows={products}
          rowKey={(product) => product.id}
          empty={
            'No products yet. Click \u201cAdd product\u201d to list your first item.'
          }
        />
      </div>
    </>
  );

  const renderReviews = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Reviews</h1>
      {reviews.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg"
            >
              <div className="flex items-center justify-between">
                <p className="font-label-lg">{review.productTitle || 'Product'}</p>
                <RatingStars rating={review.rating} />
              </div>
              <p className="font-body-md text-on-surface-variant mt-space-xs">
                {review.comment || '(no comment)'}
              </p>
              <p className="font-body-sm text-outline mt-space-sm">
                {fmtDate(review.createdAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">No reviews yet.</p>
      )}
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

  const renderNotifications = () => (
    <>
      <div className="flex items-center justify-between mb-space-md">
        <h1 className="font-headline-lg text-headline-lg">Notifications</h1>
        <button
          type="button"
          id="readAll"
          onClick={() => void onMarkAllRead()}
          className="border border-outline-variant px-space-lg py-space-sm rounded-lg font-label-lg hover:border-primary"
        >
          Mark all read
        </button>
      </div>
      {notifications.length ? (
        <div className="space-y-space-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={[
                'flex items-start gap-space-md bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-md',
                notification.readAt ? '' : 'border-l-4 border-l-primary'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="material-symbols-outlined text-primary mt-0.5">
                notifications
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-label-lg">{notification.title}</p>
                {notification.body ? (
                  <p className="font-body-sm text-on-surface-variant">
                    {notification.body}
                  </p>
                ) : null}
                <p className="font-body-sm text-outline mt-space-xs">
                  {fmtDate(notification.createdAt)}
                </p>
              </div>
              {notification.readAt ? null : (
                <button
                  type="button"
                  onClick={() => void onMarkRead(notification.id)}
                  className="text-primary font-label-md hover:underline shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">No notifications.</p>
      )}
    </>
  );

  const renderProfile = () => (
    <>
      <h1 className="font-headline-lg text-headline-lg mb-space-md">Shop profile</h1>
      <div className="max-w-xl bg-surface rounded-xl border border-outline-variant/60 shadow-sm p-space-lg space-y-space-md">
        <Input
          label="Shop name"
          id="spShopName"
          value={profileForm.shopName}
          onChange={(event) =>
            setProfileForm((current) => ({ ...current, shopName: event.target.value }))
          }
        />
        <Textarea
          label="About your shop"
          id="spBio"
          rows={3}
          value={profileForm.bio}
          onChange={(event) =>
            setProfileForm((current) => ({ ...current, bio: event.target.value }))
          }
        />
        <Textarea
          label="Delivery places (one per line)"
          id="spPlaces"
          rows={3}
          value={profileForm.places}
          onChange={(event) =>
            setProfileForm((current) => ({ ...current, places: event.target.value }))
          }
        />
        <div className="flex justify-end">
          <button
            type="button"
            id="saveProfile"
            onClick={() => void saveProfile()}
            className="bg-primary text-on-primary px-space-xl py-space-sm rounded-lg font-label-lg hover:opacity-95"
          >
            Save profile
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-space-lg">
      <aside className="lg:w-56 shrink-0">
        <nav className="flex lg:flex-col gap-space-xs overflow-x-auto bg-surface rounded-xl border border-outline-variant/60 p-space-sm">
          {SELLER_TABS.map((item) => {
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
                to={
                  item.id === 'overview'
                    ? routes.sellerDashboard
                    : `${routes.sellerDashboard}/${item.id}`
                }
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
          </div>
        ) : null}

        {tab === 'overview'
          ? renderOverview()
          : tab === 'products'
            ? renderProducts()
            : tab === 'reviews'
              ? renderReviews()
              : tab === 'returns'
                ? renderReturns()
                : tab === 'notifications'
                  ? renderNotifications()
                  : renderProfile()}
      </section>

      {productModalOpen ? (
        <ConfirmModal
          title={modalProduct ? 'Edit product' : 'Add product'}
          confirmLabel={modalProduct ? 'Save changes' : 'Add product'}
          onClose={() => setProductModalOpen(false)}
          onConfirm={saveProduct}
        >
          <div className="space-y-space-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <Input
                label="Title"
                id="pfTitle"
                value={productForm.title}
                onChange={patchProductForm('title')}
              />
              <Select
                label="Category"
                id="pfCategory"
                value={productForm.category}
                onChange={patchProductForm('category')}
              >
                {categories.length
                  ? categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))
                  : <option value="Uncategorised">Uncategorised</option>}
              </Select>
              <Input
                label={'Price (\u20a6)'}
                id="pfPrice"
                type="number"
                value={productForm.price}
                onChange={patchProductForm('price')}
              />
              <Input
                label={'Original price (\u20a6)'}
                id="pfOrigPrice"
                type="number"
                value={productForm.origPrice}
                onChange={patchProductForm('origPrice')}
              />
              <Input
                label="Availability"
                id="pfAvailability"
                value={productForm.availability}
                onChange={patchProductForm('availability')}
              />
              <div className="mt-space-lg">
                <Checkbox
                  id="pfFeatured"
                  checked={productForm.featured}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      featured: event.target.checked
                    }))
                  }
                  label="Featured"
                />
              </div>
            </div>
            <Textarea
              label="Short description"
              id="pfShort"
              rows={3}
              value={productForm.shortDescription}
              onChange={patchProductForm('shortDescription')}
            />
            <Textarea
              label="Description"
              id="pfDescription"
              rows={3}
              value={productForm.description}
              onChange={patchProductForm('description')}
            />
            <Textarea
              label="Features (one per line)"
              id="pfFeatures"
              rows={3}
              value={productForm.features}
              onChange={patchProductForm('features')}
            />
            <Textarea
              label="Sizes (one per line)"
              id="pfSizes"
              rows={3}
              value={productForm.sizes}
              onChange={patchProductForm('sizes')}
            />
            <Input
              label="Product images"
              id="pfImages"
              type="file"
              accept={PRODUCT_IMAGE_ACCEPT}
              multiple
              onChange={onProductImagesChange}
              hint="PNG, JPEG, WebP, AVIF, or GIF. Up to 8 images, 5 MB each."
            />
            {productForm.images.length ? (
              <p className="font-body-sm text-on-surface-variant">
                Selected: {productForm.images.map((file) => file.name).join(', ')}
              </p>
            ) : modalProduct ? (
              <p className="font-body-sm text-outline">
                Existing images will stay unchanged unless you select replacements.
              </p>
            ) : null}
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
