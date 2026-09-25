import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/appRoutes';
import { AppProviders } from '@/context/AppProviders';
import { setSession } from '@/lib/session';
import type {
  AppNotification,
  NotificationsPage,
  Profile,
  Product,
  ReturnRequest,
  Role,
  Seller,
  SellerApplication,
  SellerContext,
  SellerDashboard,
  SellerStats
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
vi.mock('@/api/returns', () => ({
  getReturns: vi.fn(),
  updateReturnStatus: vi.fn()
}));

import { getMe } from '@/api/auth';
import { getSettings } from '@/api/meta';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '@/api/notifications';
import {
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  updateProduct
} from '@/api/products';
import {
  getMySellerContext,
  getSellerDashboard,
  updateMySellerProfile
} from '@/api/sellers';
import { getReturns, updateReturnStatus } from '@/api/returns';

const BASIC_SETTINGS = {
  policies: { returnPolicy: 'r', sellerPolicy: 's', deliveryPolicy: 'd', privacyPolicy: 'p' },
  discounts: {
    sitewidePercent: null,
    promoCode: null,
    freeDeliveryThreshold: 500000,
    bannerEnabled: false
  }
};

/* ------------------------------------------------------------- fixtures */

function seller(overrides: Partial<Seller> = {}): Seller {
  return {
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
    ...overrides
  };
}

function application(overrides: Partial<SellerApplication> = {}): SellerApplication {
  return {
    id: 'app-1',
    userId: 'u1',
    fullName: 'Ada Customer',
    email: 'ada@spacefit.ng',
    phone: '08030011122',
    location: { city: 'Lagos', state: 'Lagos' },
    shopName: 'Ada Crafts',
    deliveryPlaces: ['Ikeja'],
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

const ACTIVE_CONTEXT: SellerContext = {
  isSeller: true,
  role: 'seller',
  seller: seller(),
  application: null
};

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

function stats(): SellerStats {
  return {
    sellerId: 's1',
    shopName: 'Ada Crafts',
    status: 'active',
    products: 4,
    unitsSold: 9,
    revenue: 1250000,
    currency: 'NGN',
    avgRating: 4.5,
    reviewsCount: 7,
    returns: { total: 2, requested: 1, approved: 1, rejected: 0, completed: 0 },
    recentOrders: [
      {
        id: 'o1',
        reference: 'SF-1001',
        status: 'paid',
        createdAt: '2026-01-05T10:00:00.000Z',
        items: 2,
        units: 3,
        value: 450000
      }
    ]
  };
}

function dashboardFixture(): SellerDashboard {
  return {
    seller: seller(),
    stats: stats(),
    reviews: [
      {
        id: 'r1',
        productId: 'p1',
        userId: 'u2',
        rating: 5,
        comment: 'Beautiful craftsmanship',
        status: 'published',
        createdAt: '2026-01-08T10:00:00.000Z',
        productTitle: 'Luna Bed'
      }
    ],
    returns: [],
    notifications: []
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

function notification(): AppNotification {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'order',
    title: 'Order paid',
    body: 'SF-1001 is paid',
    link: null,
    readAt: null,
    createdAt: '2026-01-11T10:00:00.000Z'
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

function renderDashboard(initial = '/seller-dashboard') {
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
function signIn(role: Role = 'seller') {
  const user = { id: 'u1', email: 'ada@spacefit.ng' };
  const profile: Profile = { id: 'u1', role, full_name: 'Ada Customer', phone: '08030011122' };
  setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile: null });
  vi.mocked(getMe).mockImplementation(async () => {
    setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile });
    return { user, profile };
  });
}

function useActiveSeller() {
  vi.mocked(getMySellerContext).mockResolvedValue({ ...ACTIVE_CONTEXT });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getNotifications)
    .mockReset()
    .mockResolvedValue({ items: [], unreadCount: 0 } as NotificationsPage);
  vi.mocked(getProducts).mockReset().mockResolvedValue([]);
  vi.mocked(getCategories)
    .mockReset()
    .mockResolvedValue([
      { name: 'Beds', count: 12 },
      { name: 'Sofas', count: 5 }
    ]);
  vi.mocked(getMySellerContext).mockReset().mockRejectedValue(new Error('no context'));
  vi.mocked(getSellerDashboard).mockReset().mockResolvedValue(dashboardFixture());
  vi.mocked(getReturns).mockReset().mockResolvedValue([]);
  vi.mocked(createProduct).mockReset();
  vi.mocked(updateProduct).mockReset();
  vi.mocked(deleteProduct).mockReset();
  vi.mocked(updateReturnStatus).mockReset();
  vi.mocked(updateMySellerProfile).mockReset();
  vi.mocked(markNotificationRead).mockReset();
  vi.mocked(markAllNotificationsRead).mockReset();
});

/* --------------------------------------------------------------- tests */

describe('SellerDashboardPage gates', () => {
  it('redirects signed-out visitors to the auth page', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/auth?next=%2Fseller-dashboard'
      );
    });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Sign in to sell on SpaceFit' })
    ).not.toBeInTheDocument();
    expect(getMySellerContext).not.toHaveBeenCalled();
  });

  it('shows the profile error shell when the context call fails', async () => {
    signIn('seller');
    vi.mocked(getMySellerContext).mockRejectedValue(new Error('profile service down'));
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Could not load your profile' })
    ).toBeInTheDocument();
    expect(screen.getByText('profile service down')).toBeInTheDocument();
  });

  it('shows the under-review shell for a pending application', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      isSeller: false,
      role: 'customer',
      seller: null,
      application: application({ status: 'pending' })
    });
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Application under review' })
    ).toBeInTheDocument();
    expect(screen.getByText('Ada Crafts')).toBeInTheDocument();
    expect(screen.getByText(/is being reviewed/)).toBeInTheDocument();
    expect(screen.getByText(/2\u20133 business days/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Products' })).not.toBeInTheDocument();
  });

  it('shows the rejected shell with the reviewer note and a Reapply link', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      isSeller: false,
      role: 'customer',
      seller: null,
      application: application({
        status: 'rejected',
        reviewNotes: 'Did not meet our listing standards.'
      })
    });
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Application not approved' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Reviewer note: Did not meet our listing standards.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reapply' })).toHaveAttribute(
      'href',
      '/seller-apply'
    );
  });

  it('shows the become-a-seller shell for a customer with no application', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      isSeller: false,
      role: 'customer',
      seller: null,
      application: null
    });
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Become a SpaceFit seller' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apply to sell' })).toHaveAttribute(
      'href',
      '/seller-apply'
    );
  });

  it('shows the suspension shell for a blocked seller', async () => {
    signIn('seller');
    vi.mocked(getMySellerContext).mockResolvedValue({
      ...ACTIVE_CONTEXT,
      seller: seller({ status: 'blocked' })
    });
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Seller account suspended' })
    ).toBeInTheDocument();
    expect(screen.getByText(/support@spacefit\.ng/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Overview' })).not.toBeInTheDocument();
  });
});

describe('SellerDashboardPage shell', () => {
  it('renders the overview KPIs, recent orders and the six tabs', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getProducts).mockResolvedValue([product()]);
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Ada Crafts' })).toBeInTheDocument();
    expect(await screen.findByText('SF-1001')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent orders' })).toBeInTheDocument();
    expect(screen.getByText('Products listed')).toBeInTheDocument();
    expect(screen.getByText('\u20a61,250,000')).toBeInTheDocument();
    expect(screen.getByText('Units sold')).toBeInTheDocument();

    // Scope to the sidebar: the header bell is also named "Notifications".
    const sidebar = screen.getByRole('complementary');
    for (const label of [
      'Overview',
      'My Products',
      'Reviews',
      'Returns',
      'Notifications',
      'Shop profile'
    ]) {
      expect(within(sidebar).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(sidebar).getByRole('link', { name: 'Overview' })).toHaveClass(
      'bg-primary'
    );
  });

  it('renders a tab from the :tab path segment', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard('/seller-dashboard/reviews');

    expect(await screen.findByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    expect(await screen.findByText('Beautiful craftsmanship')).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Reviews' })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('accepts the legacy #tab hash as an alias', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getNotifications).mockResolvedValue({
      items: [notification()],
      unreadCount: 1
    } as NotificationsPage);
    renderDashboard('/seller-dashboard#notifications');

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(await screen.findByText('Order paid')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/seller-dashboard');
  });

  it('redirects /seller-dashboard.html#returns to the path form', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getReturns).mockResolvedValue([returnRow()]);
    renderDashboard('/seller-dashboard.html#returns');

    expect(await screen.findByRole('heading', { name: 'Returns' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/seller-dashboard/returns')
    );
    expect(await screen.findByText('Too small')).toBeInTheDocument();
  });

  it('surfaces partial refresh failures in the banner', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getSellerDashboard).mockRejectedValue(new Error('dashboard down'));
    renderDashboard();

    expect(await screen.findByText('Some data could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText(/dashboard: dashboard down/)).toBeInTheDocument();
    // The other tabs still render.
    expect(screen.getByRole('link', { name: 'My Products' })).toBeInTheDocument();
  });
});

describe('SellerDashboardPage product CRUD', () => {
  it('validates the title inside the add modal before calling the API', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard('/seller-dashboard/products');

    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add product' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));

    expect(await screen.findByText('Enter a product title.')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add product' })).toBeInTheDocument();
  });

  it('creates a product from the add modal', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard('/seller-dashboard/products');

    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add product' });

    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Vesper Lamp' }
    });
    fireEvent.change(within(dialog).getByLabelText(/^Price/), {
      target: { value: '450000' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));

    expect(await screen.findByText('Product added.')).toBeInTheDocument();
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vesper Lamp',
        price: 450000,
        category: 'Beds',
        availability: 'In stock'
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add product' })).not.toBeInTheDocument()
    );
  });

  it('opens the edit modal prefilled and saves changes', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getProducts).mockResolvedValue([product()]);
    renderDashboard('/seller-dashboard/products');

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit product' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Luna Bed');
    // jsdom numbers: toHaveValue returns a number for input[type=number].
    expect(within(dialog).getByLabelText(/^Price/)).toHaveValue(450000);

    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Luna Bed Deluxe' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Product updated.')).toBeInTheDocument();
    expect(updateProduct).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Luna Bed Deluxe' })
    );
  });

  it('confirms deletion before removing the product', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getProducts).mockResolvedValue([product()]);
    renderDashboard('/seller-dashboard/products');

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
});

describe('SellerDashboardPage returns, notifications and profile', () => {
  it('approves a requested return with the legacy toast', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getReturns).mockResolvedValue([returnRow()]);
    renderDashboard('/seller-dashboard/returns');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Return approved.')).toBeInTheDocument();
    expect(updateReturnStatus).toHaveBeenCalledWith('ret1', 'approved');
  });

  it('marks notifications read individually and all at once', async () => {
    signIn('seller');
    useActiveSeller();
    vi.mocked(getNotifications).mockResolvedValue({
      items: [notification()],
      unreadCount: 1
    } as NotificationsPage);
    renderDashboard('/seller-dashboard/notifications');

    fireEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n1'));

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(await screen.findByText('All caught up.')).toBeInTheDocument();
    expect(markAllNotificationsRead).toHaveBeenCalled();
  });

  it('validates the shop name before saving the profile', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard('/seller-dashboard/profile');

    const shopName = await screen.findByLabelText('Shop name');
    // The seller→form sync effect may land just after the element mounts.
    await waitFor(() => expect(shopName).toHaveValue('Ada Crafts'));
    expect(screen.getByLabelText(/Delivery places/)).toHaveValue('Ikeja');

    fireEvent.change(shopName, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Enter a shop name.')).toBeInTheDocument();
    expect(updateMySellerProfile).not.toHaveBeenCalled();
  });

  it('saves the profile with trimmed fields', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard('/seller-dashboard/profile');

    const shopName = await screen.findByLabelText('Shop name');
    fireEvent.change(shopName, { target: { value: 'Ada Crafts Ltd' } });
    fireEvent.change(screen.getByLabelText(/Delivery places/), {
      target: { value: 'Ikeja\nLekki' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Shop profile saved.')).toBeInTheDocument();
    expect(updateMySellerProfile).toHaveBeenCalledWith({
      shopName: 'Ada Crafts Ltd',
      bio: 'Handmade furniture',
      deliveryPlaces: ['Ikeja', 'Lekki']
    });
  });
});

describe('SellerLayout', () => {
  it('renders the seller console chrome around the dashboard', async () => {
    signIn('seller');
    useActiveSeller();
    renderDashboard();

    await screen.findByRole('heading', { name: 'Ada Crafts' });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Seller')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Store' })).toHaveAttribute('href', '/');
    expect(
      within(banner).getByRole('link', { name: 'Notifications' })
    ).toHaveAttribute('href', '/seller-dashboard#notifications');
    expect(screen.getByText(/Seller console/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to store' })).toBeInTheDocument();
  });
});
