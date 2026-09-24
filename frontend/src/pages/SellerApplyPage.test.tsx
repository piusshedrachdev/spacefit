import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SellerApplyPage } from '@/pages/SellerApplyPage';
import { AppProviders } from '@/context/AppProviders';
import { ToastHost } from '@/layout/Chrome';
import { setSession } from '@/lib/session';
import type {
  ApplicationStatus,
  Profile,
  Role,
  Seller,
  SellerApplication,
  SellerContext
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

import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getNotifications } from '@/api/notifications';
import { getCategories } from '@/api/products';
import { getMySellerContext, submitSellerApplication } from '@/api/sellers';

const BASIC_SETTINGS = {
  policies: { returnPolicy: 'r', sellerPolicy: 's', deliveryPolicy: 'd', privacyPolicy: 'p' },
  discounts: {
    sitewidePercent: null,
    promoCode: null,
    freeDeliveryThreshold: 500000,
    bannerEnabled: false
  }
};

const BASIC_CONFIG = {
  currency: 'NGN',
  currencySymbol: '\u20a6',
  deliveryFee: 15000,
  freeDeliveryThreshold: 500000,
  vatRate: 0.075,
  serviceableCities: ['Lagos', 'Abuja'],
  paymentMethods: [{ id: 'card', label: 'Card' }]
};

const NO_APP: SellerContext = {
  isSeller: false,
  role: 'customer',
  seller: null,
  application: null
};

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

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

function renderApply(initial = '/seller-apply') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <ToastHost />
        <LocationProbe />
        <Routes>
          <Route path="/seller-apply" element={<SellerApplyPage />} />
          <Route path="/auth" element={<div data-testid="auth-page" />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

/** Sign in with a profile role (getMe persists the profile, like the client). */
function signIn(role: Role = 'customer', fullName = 'Ada Customer') {
  const user = { id: 'u1', email: 'ada@spacefit.ng' };
  const profile: Profile = { id: 'u1', role, full_name: fullName, phone: '08030011122' };
  setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile: null });
  vi.mocked(getMe).mockImplementation(async () => {
    setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile });
    return { user, profile };
  });
}

const submitButton = () => screen.getByRole('button', { name: 'Submit application' });
const querySubmitButton = () =>
  screen.queryByRole('button', { name: 'Submit application' });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getNotifications)
    .mockReset()
    .mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getCategories)
    .mockReset()
    .mockResolvedValue([
      { name: 'Beds', count: 12 },
      { name: 'Sofas', count: 5 }
    ]);
  vi.mocked(getMySellerContext)
    .mockReset()
    .mockRejectedValue(new Error('no context'));
  vi.mocked(submitSellerApplication).mockReset();
});

describe('SellerApplyPage', () => {
  it('redirects guests to /auth with ?next=', async () => {
    renderApply();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/auth?next=%2Fseller-apply'
      )
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(getMySellerContext).not.toHaveBeenCalled();
  });

  it('shows the prefilled form for a signed-in customer without an application', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({ ...NO_APP });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada Customer');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@spacefit.ng');
    expect(screen.getByLabelText('Phone')).toHaveValue('08030011122');
    // Section cards (legacy sectionCard titles).
    expect(
      screen.getByRole('heading', { name: '1. Contact details' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Your shop' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3. Terms & disclaimers' })
    ).toBeInTheDocument();
    // City select defaults to the first serviceable city (never prefilled).
    expect(screen.getByLabelText('City')).toHaveValue('Lagos');
    // Categories come from the catalogue.
    expect(screen.getByRole('option', { name: 'Beds' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sofas' })).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it('shows the pending status shell for an application under review', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      ...NO_APP,
      application: application()
    });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: 'Application under review' })
    ).toBeInTheDocument();
    expect(screen.getByText(/received your application/)).toBeInTheDocument();
    expect(screen.getByText('app-1')).toBeInTheDocument(); // Reference detail row
    expect(screen.getByText('Ikeja, Lekki')).toBeInTheDocument();
    expect(screen.getByText('Beds')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue shopping' })
    ).toHaveAttribute('href', '/');
    expect(querySubmitButton()).not.toBeInTheDocument();
  });

  it('shows the approved shell with a dashboard link', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      ...NO_APP,
      application: application({ status: 'approved' })
    });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: 'Application approved' })
    ).toBeInTheDocument();
    expect(screen.getByText(/has been approved/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open seller dashboard' })
    ).toHaveAttribute('href', '/seller-dashboard');
  });

  it('shows the rejected shell and reopens a prefilled form via Reapply', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      ...NO_APP,
      application: application({
        status: 'rejected',
        reviewNotes: 'Needs clearer photos.',
        location: { city: 'Abuja', state: 'Oyo' }
      })
    });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: 'Application not approved' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Reviewer note: Needs clearer photos\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reapply' }));

    expect(
      await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Shop name')).toHaveValue('Ada Crafts');
    expect(screen.getByLabelText('State')).toHaveValue('Oyo');
    // Chips prefilled from deliveryPlaces…
    expect(screen.getByText('Ikeja')).toBeInTheDocument();
    expect(screen.getByText('Lekki')).toBeInTheDocument();
    // …but the city select still defaults to the first serviceable city
    // (Abuja was the application city) and categories are never prefilled.
    expect(screen.getByLabelText('City')).toHaveValue('Lagos');
    const select = screen.getByLabelText('Intended categories') as HTMLSelectElement;
    expect(select.selectedOptions).toHaveLength(0);
    expect(
      screen.getByLabelText('I accept the seller terms & conditions.')
    ).not.toBeChecked();
  });

  it('shows the active-seller shell for existing sellers', async () => {
    signIn('seller', 'Sam Seller');
    vi.mocked(getMySellerContext).mockResolvedValue({
      isSeller: true,
      role: 'seller',
      seller: seller(),
      application: application({ status: 'approved' })
    });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: /SpaceFit seller/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Your shop/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open seller dashboard' })
    ).toHaveAttribute('href', '/seller-dashboard');
  });

  it('falls back to the prefilled form for an unknown application status', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({
      ...NO_APP,
      application: application({ status: 'blocked' as unknown as ApplicationStatus })
    });
    renderApply();

    expect(
      await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Shop name')).toHaveValue('Ada Crafts');
  });

  it('validates every field before submitting', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({ ...NO_APP });
    renderApply();
    await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' });

    const submit = () => fireEvent.click(submitButton());

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '' } });
    submit();
    expect(await screen.findByText('Enter your full name.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Ada Customer' }
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' }
    });
    submit();
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@spacefit.ng' }
    });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '123' } });
    submit();
    expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '08030011122' }
    });
    submit();
    expect(await screen.findByText('Enter your shop name.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Shop name'), {
      target: { value: 'Ada Crafts' }
    });
    submit();
    expect(
      await screen.findByText('Please accept the terms and disclaimers.')
    ).toBeInTheDocument();

    expect(submitSellerApplication).not.toHaveBeenCalled();
  });

  it('submits the application, toasts, and lands on the pending shell', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({ ...NO_APP });
    vi.mocked(submitSellerApplication).mockResolvedValue(application());
    renderApply();
    await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' });

    fireEvent.change(screen.getByLabelText('Shop name'), {
      target: { value: 'Ada Crafts' }
    });

    // Chip via the Add button.
    fireEvent.change(screen.getByPlaceholderText('Add a city or region'), {
      target: { value: 'Ikeja' }
    });
    fireEvent.click(screen.getByText('Add'));
    expect(await screen.findByLabelText('Remove Ikeja')).toBeInTheDocument();

    // Multi-select one category (manual selection + change, like a user click).
    const select = screen.getByLabelText('Intended categories') as HTMLSelectElement;
    const beds = Array.from(select.options).find((o) => o.value === 'Beds');
    beds!.selected = true;
    fireEvent.change(select);

    fireEvent.click(screen.getByLabelText('I accept the seller terms & conditions.'));
    fireEvent.click(screen.getByLabelText('I have read and accept the disclaimers.'));

    fireEvent.click(submitButton());

    expect(await screen.findByText(/Application submitted/)).toBeInTheDocument();
    expect(submitSellerApplication).toHaveBeenCalledWith({
      fullName: 'Ada Customer',
      email: 'ada@spacefit.ng',
      phone: '08030011122',
      shopName: 'Ada Crafts',
      city: 'Lagos',
      // State left blank → falls back to the city (legacy `stateVal || city`).
      state: 'Lagos',
      deliveryPlaces: ['Ikeja'],
      categories: ['Beds'],
      // Bio left blank → omitted from the payload.
      bio: undefined,
      termsAccepted: true,
      disclaimersAccepted: true
    });
    expect(
      await screen.findByRole('heading', { name: 'Application under review' })
    ).toBeInTheDocument();
  });

  it('adds chips with Enter and removes them via the chip button', async () => {
    signIn('customer');
    vi.mocked(getMySellerContext).mockResolvedValue({ ...NO_APP });
    renderApply();
    await screen.findByRole('heading', { name: 'Apply to sell on SpaceFit' });

    const input = screen.getByPlaceholderText('Add a city or region');
    fireEvent.change(input, { target: { value: 'Ikeja' } });
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(input, { target: { value: 'Lekki' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByLabelText('Remove Ikeja')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Lekki')).toBeInTheDocument();
    expect(input).toHaveValue('');

    fireEvent.click(screen.getByLabelText('Remove Ikeja'));
    expect(screen.queryByLabelText('Remove Ikeja')).not.toBeInTheDocument();
    expect(screen.getByText('Lekki')).toBeInTheDocument();
    expect(screen.queryByText('Ikeja')).not.toBeInTheDocument();
  });
});
