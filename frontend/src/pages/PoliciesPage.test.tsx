import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/appRoutes';
import { AppProviders } from '@/context/AppProviders';
import type { StoreSettings } from '@/types/api';

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
vi.mock('@/api/forms', () => ({
  subscribe: vi.fn(),
  bookConsultation: vi.fn()
}));

import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';

const PLACEHOLDER =
  'This policy has not been published yet. Check back soon or contact support@spacefit.ng.';
const INACTIVE_DISCOUNTS =
  'There are no active discounts right now. Subscribe to the footer newsletter to hear about the next one.';
const LOAD_ERROR = 'Could not load store policies. Please refresh the page.';

/** Settings with a save stamp (the legacy renderUpdated() field spelling). */
const FULL_SETTINGS: StoreSettings & { updatedAt?: string } = {
  policies: {
    returnPolicy: 'Returns within 7 days of delivery.',
    sellerPolicy: 'Sellers must ship within 48 hours.',
    deliveryPolicy: 'Delivery across Lagos and Abuja.',
    privacyPolicy: 'We never sell your data.'
  },
  discounts: {
    sitewidePercent: 10,
    promoCode: 'SPACE10',
    freeDeliveryThreshold: 500000,
    bannerEnabled: true
  },
  updatedAt: '2026-01-15T10:00:00.000Z'
};

/** Config threshold deliberately differs from the settings threshold. */
const BASIC_CONFIG = {
  currency: 'NGN',
  currencySymbol: '\u20a6',
  deliveryFee: 15000,
  freeDeliveryThreshold: 750000,
  vatRate: 0.075,
  serviceableCities: ['Lagos'],
  paymentMethods: [{ id: 'card', label: 'Card' }]
};

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </span>
  );
}

function renderPolicies(initial = '/policies') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <LocationProbe />
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...FULL_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
});

describe('PoliciesPage', () => {
  it('renders the fetched copy, discount card, free-delivery note, stamp and anchors', async () => {
    const { container } = renderPolicies();

    // The four policy sections.
    expect(
      await screen.findByText('Returns within 7 days of delivery.')
    ).toBeInTheDocument();
    expect(screen.getByText('Delivery across Lagos and Abuja.')).toBeInTheDocument();
    expect(screen.getByText('Sellers must ship within 48 hours.')).toBeInTheDocument();
    expect(screen.getByText('We never sell your data.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Returns & refunds', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Discounts & offers', level: 2 })
    ).toBeInTheDocument();

    // Active discount card — the settings threshold wins over the config one,
    // so both \u20a6500,000 occurrences (note + card) come from settings.
    expect(screen.getByText('10% off')).toBeInTheDocument();
    expect(screen.getByText('SPACE10')).toBeInTheDocument();
    expect(screen.getAllByText('\u20a6500,000')).toHaveLength(2);
    expect(screen.getByText(/Free delivery above/)).toBeInTheDocument();

    // Free-delivery note + "Last updated" stamp (legacy renderers).
    expect(screen.getByText(/Delivery is free on orders of/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();

    // Cross-page CTA + the legacy in-page fragment anchors.
    expect(screen.getByRole('link', { name: 'Apply to sell' })).toHaveAttribute(
      'href',
      '/seller-apply'
    );
    for (const hash of ['returns', 'delivery', 'sellers', 'privacy', 'discounts']) {
      expect(container.querySelector(`a[href="#${hash}"]`)).toBeInTheDocument();
    }
  });

  it('shows the unpublished placeholder for a blank policy', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      policies: { ...FULL_SETTINGS.policies, returnPolicy: '   ' },
      discounts: FULL_SETTINGS.discounts
    });
    renderPolicies();

    expect(await screen.findByText(PLACEHOLDER)).toBeInTheDocument();
    // The other sections keep their real copy.
    expect(screen.getByText('We never sell your data.')).toBeInTheDocument();
  });

  it('falls back to the config threshold when the settings threshold is absent', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      policies: FULL_SETTINGS.policies,
      discounts: { ...FULL_SETTINGS.discounts, freeDeliveryThreshold: null }
    });
    renderPolicies();

    const note = await screen.findByText(/Delivery is free on orders of/);
    expect(within(note).getByText('\u20a6750,000')).toBeInTheDocument();
    expect(getConfig).toHaveBeenCalled();
    // No saved threshold → no card item (legacy li guard).
    expect(screen.queryByText(/Free delivery above/)).not.toBeInTheDocument();
  });

  it('renders the inactive-discount message when the banner is disabled', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      policies: FULL_SETTINGS.policies,
      discounts: {
        sitewidePercent: null,
        promoCode: null,
        freeDeliveryThreshold: 500000,
        bannerEnabled: false
      }
    });
    renderPolicies();

    expect(await screen.findByText(INACTIVE_DISCOUNTS)).toBeInTheDocument();
  });

  it('degrades to placeholders, the error banner and a toast when settings fail', async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error('boom'));
    renderPolicies();

    // Banner (panel) + toast — the legacy fail() pair (findAll accepts both).
    expect(await screen.findAllByText(LOAD_ERROR)).toHaveLength(2);
    // All four sections fall back to the placeholder.
    expect(screen.getAllByText(PLACEHOLDER)).toHaveLength(4);
    expect(screen.getByText(INACTIVE_DISCOUNTS)).toBeInTheDocument();
    // Note + stamp only render after a successful load (legacy init()).
    expect(
      screen.queryByText(/Delivery is free on orders of/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
  });

  it('redirects /policies.html#discounts to /policies preserving the section hash', async () => {
    renderPolicies('/policies.html#discounts');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/policies#discounts')
    );
    expect(
      await screen.findByRole('heading', { name: 'Discounts & offers', level: 2 })
    ).toBeInTheDocument();
  });
});
