import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { AppProviders } from '@/context/AppProviders';
import { setSession } from '@/lib/session';
import type { Product } from '@/types/api';

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
import { getCategories, getProducts } from '@/api/products';

function product(overrides: Partial<Product>): Product {
  return {
    id: 'luna-bed',
    title: 'Luna Bed',
    slug: 'luna-bed',
    category: 'Beds',
    price: 450000,
    origPrice: null,
    currency: 'NGN',
    rating: 4.8,
    reviews: 14,
    availability: 'In Stock',
    shortDescription: 'Solid wood frame',
    description: 'A modern bed.',
    features: [],
    specs: [],
    colors: [],
    sizes: [],
    images: ['/img/luna.jpg'],
    featured: false,
    sellerId: null,
    sellerName: null,
    ...overrides
  };
}

const BED = product({ id: 'luna-bed', title: 'Luna Bed', price: 450000 });
const DESK = product({ id: 'apex-desk', title: 'Apex Desk', category: 'Desks', price: 120000 });

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
  serviceableCities: ['Lagos'],
  paymentMethods: [{ id: 'card', label: 'Card' }]
};

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppProviders>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getProducts).mockReset().mockResolvedValue([BED, DESK]);
  vi.mocked(getCategories)
    .mockReset()
    .mockResolvedValue([
      { name: 'Beds', count: 12 },
      { name: 'Desks', count: 5 }
    ]);
});

describe('HomePage', () => {
  it('renders the hero and the product catalogue', async () => {
    renderHome();

    expect(
      await screen.findByRole('heading', { name: /explore furniture/i, level: 1 })
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Luna Bed' })).toHaveAttribute(
      'href',
      '/products/luna-bed'
    );
    expect(screen.getByRole('link', { name: 'Apex Desk' })).toHaveAttribute(
      'href',
      '/products/apex-desk'
    );
    expect(getProducts).toHaveBeenCalled();
    expect(getCategories).toHaveBeenCalled();
  });

  it('filters the catalogue when a sidebar category is chosen', async () => {
    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: /Beds \(12\)/ }));

    await vi.waitFor(() =>
      expect(getProducts).lastCalledWith(
        expect.objectContaining({ category: 'Beds' })
      )
    );
  });

  it('re-sorts the grid client-side from the toolbar dropdown', async () => {
    renderHome();
    await screen.findByRole('link', { name: 'Luna Bed' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort pieces' }), {
      target: { value: 'price-asc' }
    });

    await vi.waitFor(() => {
      const links = screen
        .getAllByRole('link')
        .filter((node) => (node.getAttribute('href') ?? '').startsWith('/products/'));
      expect(links[0]).toHaveAttribute('href', '/products/apex-desk');
    });
  });

  it('applies the search from the hero search bar', async () => {
    renderHome();
    const input = await screen.findByPlaceholderText(/Search furniture/i);
    fireEvent.change(input, { target: { value: 'desk' } });
    fireEvent.submit(input.closest('form')!);

    await vi.waitFor(() =>
      expect(getProducts).lastCalledWith(expect.objectContaining({ search: 'desk' }))
    );
  });

  it('hides the consultation banner from guests', async () => {
    const view = renderHome();
    await screen.findByRole('link', { name: 'Luna Bed' });
    expect(
      screen.queryByRole('button', { name: /Book Spatial Measurement/i })
    ).not.toBeInTheDocument();
    view.unmount();
  });

  it('shows the consultation banner to signed-in customers', async () => {
    // Sign in as a customer (getMe persists the profile).
    const user = { id: 'u1', email: 'ada@spacefit.ng' };
    const profile = { id: 'u1', role: 'customer' as const, full_name: 'Ada' };
    setSession({ accessToken: 't', refreshToken: 'r', user, profile: null });
    vi.mocked(getMe).mockImplementation(async () => {
      setSession({ accessToken: 't', refreshToken: 'r', user, profile });
      return { user, profile };
    });

    renderHome();
    expect(
      await screen.findByRole('button', { name: /Book Spatial Measurement/i })
    ).toBeInTheDocument();
  });
});
