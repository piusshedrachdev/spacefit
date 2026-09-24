import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/appRoutes';
import { AppProviders } from '@/context/AppProviders';
import { DEV_USER_KEY, setSession } from '@/lib/session';
import type {
  Order,
  Profile,
  Product,
  ReturnRequest,
  Role,
  Seller,
  SellerApplication,
  SellerListRow,
  StoreSettings
} from '@/types/api';

vi.mock('@/api/meta', () => ({
  getConfig: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn()
}));
vi.mock('@/api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn()
}));
vi.mock('@/api/notifications', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn()
}));
vi.mock('@/api/products', () => ({
  getProducts: vi.fn(),
  getFeaturedProducts: vi.fn(),
  getProduct: vi.fn(),
  getRelatedProducts: vi.fn(),
  getCategories: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductReviews: vi.fn(),
  createProductReview: vi.fn()
}));
vi.mock('@/api/sellers', () => ({
  submitSellerApplication: vi.fn(),
  getMySellerContext: vi.fn(),
  updateMySellerProfile: vi.fn(),
  getSellerDashboard: vi.fn(),
  getApplications: vi.fn(),
  getApplication: vi.fn(),
  reviewApplication: vi.fn(),
  getSellers: vi.fn(),
  setSellerStatus: vi.fn()
}));
vi.mock('@/api/orders', () => ({
  placeOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn()
}));
vi.mock('@/api/returns', () => ({
  getReturns: vi.fn(),
  updateReturnStatus: vi.fn()
}));

import { getMe } from '@/api/auth';
import { getSettings, saveSettings } from '@/api/meta';
import { getNotifications } from '@/api/notifications';
import { deleteProduct, getProducts, updateProduct } from '@/api/products';
import {
  getApplications,
  getMySellerContext,
  getSellerDashboard,
  getSellers,
  reviewApplication,
  setSellerStatus
} from '@/api/sellers';
import { getOrders } from '@/api/orders';
import { getReturns, updateReturnStatus } from '@/api/returns';

const FULL_SETTINGS: StoreSettings = {
  policies: {
    returnPolicy: 'Return policy text',
    sellerPolicy: 'Seller policy text',
    deliveryPolicy: 'Delivery policy text',
    privacyPolicy: 'Privacy policy text'
  },
  discounts: {
    sitewidePercent: 10,
    promoCode: 'SPACE10',
    freeDeliveryThreshold: 500000,
    bannerEnabled: true
  }
};

/* ------------------------------------------------------------- fixtures */

function application(overrides: Partial<SellerApplication> = {}): SellerApplication {
  return {
    id: 'app-1',
    userId: 'u1',
    fullName: 'Ada Customer',
    email: 'ada@spacefit.ng',
    phone: '08030011122',
    location: { city: 'Lagos', state: 'Lagos' },
    shopName: 'Ada Crafts',
    deliveryPlaces: ['Ikeja', 'Lekki'],
    categories: ['Beds'],
    bio: 'Handmade furniture',
    termsAccepted: true,
    disclaimersAccepted: true,
    status: 'pending',
    reviewNotes: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides
  };
}

function sellerRow(overrides: Partial<Seller> & { products?: number } = {}): SellerListRow {
  const { products, ...rest } = overrides;
  const base: Seller = {
    id: 's1',
    userId: 'u1',
    applicationId: 'app-1',
    shopName: 'Ada Crafts',
    deliveryPlaces: ['Ikeja'],
    bio: 'Handmade furniture',
    status: 'active',
    rating: 4.8,
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    ...rest
  };
  return { ...base, products: products ?? 4 };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Luna Bed',
    slug: 'luna-bed',
    category: 'Beds',
    price: 450000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.8,
    reviews: 3,
    availability: 'In stock',
    shortDescription: 'A solid oak bed.',
    description: 'Long description.',
    features: ['Solid oak'],
    specs: [],
    colors: [],
    sizes: ['Queen'],
    images: ['/img/luna.jpg'],
    featured: true,
    sellerId: 's1',
    sellerName: 'Ada Crafts',
    ...overrides
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    reference: 'SF-1001',
    status: 'paid',
    items: [],
    // Distinct from the signed-in profile name (the hidden account-menu <p>
    // carries it in the DOM and would make getByText ambiguous).
    customer: { fullName: 'Chidi Buyer', email: 'chidi@spacefit.ng', phone: '08030011133' },
    delivery: { address: '12 Rumuola', city: 'Port Harcourt', state: 'Rivers' },
    paymentMethod: 'card',
    notes: null,
    currency: 'NGN',
    subtotal: 450000,
    deliveryFee: 0,
    vat: 0,
    total: 450000,
    createdAt: '2026-01-05T10:00:00.000Z',
    ...overrides
  };
}

function returnRow(overrides: Partial<ReturnRequest> = {}): ReturnRequest {
  return {
    id: 'ret1',
    orderId: 'o1',
    productId: 'p1',
    sellerId: 's1',
    requestedBy: 'u2',
    reason: 'Too small',
    status: 'requested',
    resolutionNotes: null,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
    productTitle: 'Luna Bed',
    ...overrides
  };
}

/* --------------------------------------------------------------- render */

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

function renderAdmin(initial = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <LocationProbe />
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>
  );
}

/** Sign in with a profile role (getMe persists the profile, like the client). */
function signIn(role: Role = 'admin') {
  const user = { id: 'u1', email: 'ada@spacefit.ng' };
  const profile: Profile = { id: 'u1', role, full_name: 'Ada Customer', phone: '08030011122' };
  setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile: null });
  vi.mocked(getMe).mockImplementation(async () => {
    setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile });
    return { user, profile };
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...FULL_SETTINGS });
  vi.mocked(saveSettings).mockReset().mockResolvedValue({ ...FULL_SETTINGS });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getNotifications)
    .mockReset()
    .mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getProducts).mockReset().mockResolvedValue([product()]);
  vi.mocked(getMySellerContext).mockReset().mockRejectedValue(new Error('no context'));
  vi.mocked(getSellerDashboard).mockReset();
  vi.mocked(getApplications).mockReset().mockResolvedValue([application()]);
  vi.mocked(getSellers).mockReset().mockResolvedValue([sellerRow()]);
  vi.mocked(getOrders).mockReset().mockResolvedValue([order()]);
  vi.mocked(getReturns).mockReset().mockResolvedValue([returnRow()]);
  vi.mocked(reviewApplication).mockReset();
  vi.mocked(setSellerStatus).mockReset();
  vi.mocked(updateProduct).mockReset();
  vi.mocked(deleteProduct).mockReset();
  vi.mocked(updateReturnStatus).mockReset();
});

/* --------------------------------------------------------------- tests */

describe('AdminDashboardPage gates', () => {
  it('shows the origin message when signed out', async () => {
    renderAdmin();

    expect(
      await screen.findByRole('heading', { name: 'Admin access required' })
    ).toBeInTheDocument();
    expect(screen.getByText(/not signed in on this page/)).toBeInTheDocument();
    // getByText (not role): the header's account control is also named "Sign in".
    expect(screen.getByText('Sign in')).toHaveAttribute(
      'href',
      '/auth?next=%2Fadmin'
    );
    expect(getMe).not.toHaveBeenCalled();
  });

  it('denies when the fresh getMe fails, with the legacy error copy', async () => {
    signIn('admin');
    vi.mocked(getMe).mockRejectedValue(new Error('profile service down'));
    renderAdmin();

    expect(
      await screen.findByRole('heading', { name: 'Admin access required' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Could not load your profile \(profile service down\)/)
    ).toBeInTheDocument();
    expect(screen.getByText(/session may have expired/)).toBeInTheDocument();
  });

  it('denies non-admin roles with the role message', async () => {
    signIn('customer');
    renderAdmin();

    expect(
      await screen.findByRole('heading', { name: 'Admin access required' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Your account role is "customer"\./)).toBeInTheDocument();
    expect(
      screen.getByText(/An administrator account is required\./)
    ).toBeInTheDocument();
  });

  it('admits the memory-mode dev admin even with a customer profile', async () => {
    signIn('customer');
    localStorage.setItem(DEV_USER_KEY, 'dev-user-admin');
    renderAdmin();

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Applications' })).toBeInTheDocument();
  });
});

describe('AdminDashboardPage shell', () => {
  it('renders the overview KPIs, latest applications and the seven tabs', async () => {
    signIn('admin');
    renderAdmin();

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByText('\u20a6450,000')).toBeInTheDocument();
    expect(screen.getByText('Pending applications')).toBeInTheDocument();
    expect(screen.getByText('Recorded revenue')).toBeInTheDocument();
    expect(screen.getByText('Blocked sellers')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Latest applications' })
    ).toBeInTheDocument();
    expect(screen.getByText('Ada Crafts')).toBeInTheDocument();

    const sidebar = screen.getByRole('complementary');
    for (const label of [
      'Overview',
      'Applications',
      'Sellers',
      'Products',
      'Orders',
      'Returns',
      'Settings'
    ]) {
      expect(within(sidebar).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(sidebar).getByRole('link', { name: 'Overview' })).toHaveClass(
      'bg-primary'
    );
  });

  it('accepts the legacy #tab hash as an alias', async () => {
    signIn('admin');
    renderAdmin('/admin#settings');

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
    expect(
      within(screen.getByRole('complementary')).getByRole('link', {
        name: 'Settings'
      })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('redirects /admin.html#applications to the path form', async () => {
    signIn('admin');
    renderAdmin('/admin.html#applications');

    expect(
      await screen.findByRole('heading', { name: 'Applications' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/applications')
    );
    expect(await screen.findByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it('surfaces partial refresh failures in the legacy banner', async () => {
    signIn('admin');
    vi.mocked(getApplications).mockRejectedValue(new Error('queue down'));
    renderAdmin();

    expect(
      await screen.findByText('Some data could not be loaded.')
    ).toBeInTheDocument();
    expect(screen.getByText(/applications: queue down/)).toBeInTheDocument();
    expect(screen.getByText(/open this page via/)).toBeInTheDocument();
    // The rest of the dashboard still renders.
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sellers' })).toBeInTheDocument();
  });
});

describe('AdminDashboardPage applications', () => {
  it('reviews and approves a pending application with notes', async () => {
    signIn('admin');
    renderAdmin('/admin/applications');

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ada Crafts' });

    expect(within(dialog).getByText('Applicant:')).toBeInTheDocument();
    expect(within(dialog).getByText('Ada Customer (ada@spacefit.ng)')).toBeInTheDocument();
    expect(within(dialog).getByText('Terms accepted:')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Review notes (optional)'), {
      target: { value: 'Looks good' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Application approved.')).toBeInTheDocument();
    expect(reviewApplication).toHaveBeenCalledWith('app-1', 'approved', 'Looks good');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Ada Crafts' })).not.toBeInTheDocument()
    );
  });

  it('rejects a pending application', async () => {
    signIn('admin');
    renderAdmin('/admin/applications');

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ada Crafts' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Application rejected.')).toBeInTheDocument();
    expect(reviewApplication).toHaveBeenCalledWith('app-1', 'rejected', undefined);
  });

  it('shows the already-reviewed shell for a non-pending application', async () => {
    signIn('admin');
    vi.mocked(getApplications).mockResolvedValue([
      application({ status: 'approved', reviewNotes: 'Earlier note' })
    ]);
    renderAdmin('/admin/applications');

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ada Crafts' });

    expect(
      within(dialog).getByText('This application has already been approved.')
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Previous notes:')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(reviewApplication).not.toHaveBeenCalled();
  });
});

describe('AdminDashboardPage sellers, products, orders and returns', () => {
  it('blocks a seller through the confirm modal with an optional reason', async () => {
    signIn('admin');
    renderAdmin('/admin/sellers');

    fireEvent.click(await screen.findByRole('button', { name: 'Block' }));
    const dialog = await screen.findByRole('dialog', { name: 'Block Ada Crafts?' });
    expect(
      within(dialog).getByText(
        'The seller\u2019s listings will be hidden from the storefront and they will be notified.'
      )
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText('Reason (optional)'), {
      target: { value: 'Late shipments' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block seller' }));

    expect(await screen.findByText('Seller blocked.')).toBeInTheDocument();
    expect(setSellerStatus).toHaveBeenCalledWith('s1', 'blocked', 'Late shipments');
  });

  it('saves an inline product edit', async () => {
    signIn('admin');
    renderAdmin('/admin/products');

    fireEvent.change(await screen.findByLabelText('Price for Luna Bed'), {
      target: { value: '500000' }
    });
    expect(screen.getByLabelText('Featured: Luna Bed')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Product updated.')).toBeInTheDocument();
    expect(updateProduct).toHaveBeenCalledWith('p1', {
      price: 500000,
      availability: 'In stock',
      featured: true
    });
  });

  it('confirms deletion before removing a product', async () => {
    signIn('admin');
    renderAdmin('/admin/products');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete product?' });
    expect(
      within(dialog).getByText('Luna Bed will be permanently removed.')
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Product deleted.')).toBeInTheDocument();
    expect(deleteProduct).toHaveBeenCalledWith('p1');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Delete product?' })).not.toBeInTheDocument()
    );
  });

  it('renders orders read-only', async () => {
    signIn('admin');
    renderAdmin('/admin/orders');

    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(await screen.findByText('SF-1001')).toBeInTheDocument();
    expect(screen.getByText('Chidi Buyer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('approves a return request', async () => {
    signIn('admin');
    renderAdmin('/admin/returns');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Return approved.')).toBeInTheDocument();
    expect(updateReturnStatus).toHaveBeenCalledWith('ret1', 'approved');
  });
});

describe('AdminDashboardPage settings', () => {
  it('prefills and saves the policies + discounts form', async () => {
    signIn('admin');
    renderAdmin('/admin/settings');

    const returnPolicy = await screen.findByLabelText('Return policy');
    await waitFor(() => expect(returnPolicy).toHaveValue('Return policy text'));
    expect(screen.getByLabelText('Sitewide discount (%)')).toHaveValue(10);
    expect(screen.getByLabelText('Promo code')).toHaveValue('SPACE10');
    expect(screen.getByLabelText('Free-delivery threshold')).toHaveValue(500000);
    expect(screen.getByLabelText('Show discount banner')).toBeChecked();

    fireEvent.change(screen.getByLabelText('Sitewide discount (%)'), {
      target: { value: '15' }
    });
    fireEvent.change(screen.getByLabelText('Promo code'), {
      target: { value: ' SPACE15 ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(saveSettings).toHaveBeenCalledWith({
      policies: {
        returnPolicy: 'Return policy text',
        sellerPolicy: 'Seller policy text',
        deliveryPolicy: 'Delivery policy text',
        privacyPolicy: 'Privacy policy text'
      },
      discounts: {
        sitewidePercent: 15,
        promoCode: 'SPACE15',
        freeDeliveryThreshold: 500000,
        bannerEnabled: true
      }
    });
  });
});

describe('AdminLayout', () => {
  it('renders the admin console chrome around the dashboard', async () => {
    signIn('admin');
    renderAdmin();

    await screen.findByRole('heading', { name: 'Overview' });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Admin')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Store' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(
      within(banner).getByRole('link', { name: 'Notifications' })
    ).toHaveAttribute('href', '/admin#overview');
    expect(within(banner).getByText('Admin dashboard')).toHaveAttribute('href', '/admin');
    expect(screen.getByText(/Admin console/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to store' })).toBeInTheDocument();
  });
});
