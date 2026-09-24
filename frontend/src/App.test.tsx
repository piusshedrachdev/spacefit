import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

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
import { getNotifications } from '@/api/notifications';
import { getCategories, getProducts } from '@/api/products';
import type { Product } from '@/types/api';

const PRODUCT: Product = {
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
  sellerName: null
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings)
    .mockReset()
    .mockResolvedValue({
      policies: { returnPolicy: 'r', sellerPolicy: 's', deliveryPolicy: 'd', privacyPolicy: 'p' },
      discounts: {
        sitewidePercent: null,
        promoCode: null,
        freeDeliveryThreshold: 500000,
        bannerEnabled: false
      }
    });
  vi.mocked(getConfig)
    .mockReset()
    .mockResolvedValue({
      currency: 'NGN',
      currencySymbol: '\u20a6',
      deliveryFee: 15000,
      freeDeliveryThreshold: 500000,
      vatRate: 0.075,
      serviceableCities: ['Lagos'],
      paymentMethods: [{ id: 'card', label: 'Card' }]
    });
  vi.mocked(getNotifications).mockReset().mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getProducts).mockReset().mockResolvedValue([PRODUCT]);
  vi.mocked(getCategories).mockReset().mockResolvedValue([{ name: 'Beds', count: 12 }]);
});

describe('App shell (Phase 3 home)', () => {
  it('renders the ported home hero inside the shared chrome', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /explore furniture/i, level: 1 })
    ).toBeInTheDocument();
    // Header brand from StorefrontLayout.
    expect(screen.getByAltText('SpaceFit Brand Logo')).toBeInTheDocument();
  });

  it('loads the catalogue and links products through the SPA', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Luna Bed' })).toHaveAttribute(
      'href',
      '/products/luna-bed'
    );
    expect(getProducts).toHaveBeenCalled();
  });

  it('keeps the footer policy links pointing at the legacy policies page', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Policies' })).toHaveAttribute(
      'href',
      '/policies.html'
    );
  });
});
