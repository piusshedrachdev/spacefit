import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from '@/components/commerce/ProductCard';
import { AppProviders } from '@/context/AppProviders';
import type { Cart, Product } from '@/types/api';

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
vi.mock('@/api/cart', () => ({
  createCart: vi.fn(),
  getCart: vi.fn(),
  ensureCart: vi.fn(),
  resolveProductId: vi.fn(),
  addToCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  validateCart: vi.fn()
}));

import { addToCart } from '@/api/cart';
import { getConfig, getSettings } from '@/api/meta';

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
  description: 'A modern and comfortable bed frame.',
  features: [],
  specs: [],
  colors: [],
  sizes: [],
  images: ['/img/luna.jpg'],
  featured: false,
  sellerId: null,
  sellerName: null
};

const ADDED_CART: Cart = {
  id: 'c1',
  items: [],
  itemCount: 1,
  currency: 'NGN',
  subtotal: 450000,
  delivery: 0,
  vat: 0,
  total: 450000
};

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

function renderCard(product: Product, variant?: 'grid' | 'related') {
  return render(
    <MemoryRouter>
      <AppProviders>
        <ProductCard product={product} variant={variant} />
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(addToCart).mockReset().mockResolvedValue({ ...ADDED_CART });
});

describe('ProductCard (grid variant)', () => {
  it('renders the product and links to the SPA product page', async () => {
    renderCard(PRODUCT);

    const link = await screen.findByRole('link', { name: 'Luna Bed' });
    expect(link).toHaveAttribute('href', '/products/luna-bed');
    expect(screen.getByText('Beds')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('\u20a6450,000')).toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('shows the featured badge when the product is featured', async () => {
    renderCard({ ...PRODUCT, featured: true });
    expect(await screen.findByText('Featured')).toBeInTheDocument();
  });

  it('adds the product to the cart through the shared hook', async () => {
    renderCard(PRODUCT);
    await screen.findByRole('link', { name: 'Luna Bed' });

    // The icon + label spans live in one button; grab the label and climb up.
    fireEvent.click(screen.getByText('Add', { exact: true }).closest('button')!);
    await vi.waitFor(() =>
      expect(addToCart).toHaveBeenCalledWith('luna-bed', 1, undefined, undefined)
    );
  });
});

describe('ProductCard (related variant)', () => {
  it('renders the compact card with an icon add button', async () => {
    renderCard(PRODUCT, 'related');

    // Image + title are both links to the same product page.
    const links = await screen.findAllByRole('link', { name: 'Luna Bed' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/products/luna-bed');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Add Luna Bed to cart' }));
    await vi.waitFor(() =>
      expect(addToCart).toHaveBeenCalledWith('luna-bed', 1, undefined, undefined)
    );
    // Related cards are compact: no category chrome.
    expect(screen.queryByText('Beds')).not.toBeInTheDocument();
  });
});
