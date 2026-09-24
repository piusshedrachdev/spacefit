import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetailsPage } from '@/pages/ProductDetailsPage';
import { AppProviders } from '@/context/AppProviders';
import { ToastHost } from '@/layout/Chrome';
import type { Cart, Product, Profile } from '@/types/api';

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
vi.mock('@/api/wishlist', () => ({
  getWishlist: vi.fn(),
  addWishlistItem: vi.fn(),
  removeWishlistItem: vi.fn()
}));

import { addToCart } from '@/api/cart';
import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getProduct, getRelatedProducts } from '@/api/products';
import { addWishlistItem, getWishlist } from '@/api/wishlist';
import { setSession } from '@/lib/session';

const PRODUCT: Product = {
  id: 'luna-bed',
  title: 'Luna Bed',
  slug: 'luna-bed',
  category: 'Beds',
  price: 450000,
  origPrice: 500000,
  currency: 'NGN',
  rating: 4.8,
  reviews: 14,
  availability: 'In Stock',
  shortDescription: 'Solid wood frame',
  description: 'A modern and comfortable bed frame for deliberate living.',
  features: ['Hand-oiled walnut finish', 'Reinforced slat base'],
  specs: [{ label: 'Material', value: 'Solid oak frame' }],
  colors: [
    { name: 'Walnut', hex: '#6f4e37' },
    { name: 'Oak', hex: '#c8a77b' }
  ],
  sizes: ['Queen', 'King'],
  images: ['/img/luna-1.jpg', '/img/luna-2.jpg'],
  featured: false,
  sellerId: null,
  sellerName: null
};

const RELATED: Product = {
  ...PRODUCT,
  id: 'aura-chair',
  title: 'Aura Chair',
  category: 'Chairs',
  price: 180000,
  origPrice: null,
  images: ['/img/aura.jpg'],
  colors: [],
  sizes: [],
  features: [],
  specs: []
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

function renderPdp(initial = '/products/luna-bed') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <ToastHost />
        <Routes>
          <Route path="/products/:id" element={<ProductDetailsPage />} />
          {/* No :id param → exercises the legacy default (product-details.html?id= missing). */}
          <Route path="/pdp" element={<ProductDetailsPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

/** Sign in as a customer (getMe persists the profile, like the client). */
function signIn() {
  const user = { id: 'u1', email: 'ada@spacefit.ng' };
  const profile: Profile = { id: 'u1', role: 'customer', full_name: 'Ada Customer', phone: '08030011122' };
  setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile: null });
  vi.mocked(getMe).mockImplementation(async () => {
    setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile });
    return { user, profile };
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getProduct).mockReset().mockResolvedValue({ ...PRODUCT });
  vi.mocked(getRelatedProducts).mockReset().mockResolvedValue([{ ...RELATED }]);
  vi.mocked(addToCart).mockReset().mockResolvedValue({ ...ADDED_CART });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getWishlist).mockReset().mockResolvedValue([]);
  vi.mocked(addWishlistItem).mockReset().mockResolvedValue({ ...PRODUCT });
});

describe('ProductDetailsPage', () => {
  it('renders the product, specs and the related row', async () => {
    renderPdp();

    expect(
      await screen.findByRole('heading', { name: 'Luna Bed', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('\u20a6450,000')).toBeInTheDocument();
    expect(screen.getByText('\u20a6500,000')).toBeInTheDocument(); // strikethrough
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('(14 reviews)')).toBeInTheDocument();

    // Specs table.
    expect(screen.getByRole('heading', { name: 'Specifications' })).toBeInTheDocument();
    expect(screen.getByText('Material')).toBeInTheDocument();
    expect(screen.getByText('Solid oak frame')).toBeInTheDocument();

    // Related products link through the SPA.
    expect(screen.getByRole('heading', { name: 'You may also like' })).toBeInTheDocument();
    const relatedLinks = screen.getAllByRole('link', { name: 'Aura Chair' });
    expect(relatedLinks.length).toBeGreaterThan(0);
    for (const link of relatedLinks) {
      expect(link).toHaveAttribute('href', '/products/aura-chair');
    }
    expect(getProduct).toHaveBeenCalledWith('luna-bed');
  });

  it('switches the main gallery image from a thumbnail', async () => {
    renderPdp();
    await screen.findByRole('heading', { name: 'Luna Bed', level: 1 });

    expect(screen.getByAltText('Luna Bed')).toHaveAttribute('src', '/img/luna-1.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'View image 2' }));
    expect(screen.getByAltText('Luna Bed')).toHaveAttribute('src', '/img/luna-2.jpg');
  });

  it('adds the chosen colour, size and quantity to the cart', async () => {
    renderPdp();
    await screen.findByRole('heading', { name: 'Luna Bed', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Oak' }));
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'King' } });
    expect(screen.getByLabelText('Size')).toHaveValue('King');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    fireEvent.click(screen.getByText('Add to Cart', { exact: true }).closest('button')!);

    await vi.waitFor(() =>
      expect(addToCart).toHaveBeenCalledWith('luna-bed', 3, 'King', 'Oak')
    );
    // The shared hook confirms via toast (host rendered by the layout).
    expect(await screen.findByText(/Luna Bed \(x3\) added/)).toBeInTheDocument();
  });

  it('shows the error panel and recovers via Try again', async () => {
    vi.mocked(getProduct).mockRejectedValue(new Error('boom'));
    renderPdp();

    expect(await screen.findByText("Couldn't load this product")).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();

    // Retry succeeds once the endpoint recovers.
    vi.mocked(getProduct).mockResolvedValue({ ...PRODUCT });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Luna Bed', level: 1 })).toBeInTheDocument();
  });

  it('falls back to the legacy default product when the id is missing', async () => {
    renderPdp('/pdp');
    await screen.findByRole('heading', { name: 'Luna Bed', level: 1 });
    expect(getProduct).toHaveBeenCalledWith('luna-bed');
  });

  it('saves the product to the wishlist when the heart is clicked (signed in)', async () => {
    signIn();
    renderPdp();
    await screen.findByRole('heading', { name: 'Luna Bed', level: 1 });

    // The PDP heart plus one per related card share the label; the page's own
    // heart renders first (the related row sits after the purchase column).
    const [heart] = screen.getAllByRole('button', { name: 'Add to wishlist' });
    fireEvent.click(heart);

    await vi.waitFor(() => expect(addWishlistItem).toHaveBeenCalledWith('luna-bed'));
    expect(
      await screen.findByRole('button', { name: 'Remove from wishlist' })
    ).toBeInTheDocument();
  });

  it('prompts sign-in instead of saving when signed out', async () => {
    renderPdp();
    await screen.findByRole('heading', { name: 'Luna Bed', level: 1 });

    const [heart] = screen.getAllByRole('button', { name: 'Add to wishlist' });
    fireEvent.click(heart);

    expect(
      await screen.findByText('Sign in to save items to your wishlist.')
    ).toBeInTheDocument();
    expect(addWishlistItem).not.toHaveBeenCalled();
  });
});
