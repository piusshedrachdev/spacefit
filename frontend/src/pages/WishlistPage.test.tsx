import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WishlistPage } from '@/pages/WishlistPage';
import { AppProviders } from '@/context/AppProviders';
import { ToastHost } from '@/layout/Chrome';
import type { Profile, Product } from '@/types/api';

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

import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getWishlist, removeWishlistItem } from '@/api/wishlist';
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
  features: [],
  specs: [],
  colors: [],
  sizes: [],
  images: ['/img/luna-1.jpg'],
  featured: false,
  sellerId: null,
  sellerName: null
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

function renderWishlist() {
  return render(
    <MemoryRouter initialEntries={['/wishlist']}>
      <AppProviders>
        <ToastHost />
        <WishlistPage />
      </AppProviders>
    </MemoryRouter>
  );
}

/** Sign in as a customer (getMe persists the profile, like the client). */
function signIn(role: Profile['role'] = 'customer') {
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
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(getWishlist).mockReset().mockResolvedValue([]);
  vi.mocked(removeWishlistItem).mockReset().mockResolvedValue({ productId: 'luna-bed', removed: true });
});

describe('WishlistPage', () => {
  it('shows the sign-in gate when signed out (no wishlist fetch)', async () => {
    renderWishlist();

    expect(
      await screen.findByRole('heading', { name: 'Sign in to see your wishlist' })
    ).toBeInTheDocument();
    expect(screen.getByText('Save the pieces you love and pick up right where you left off, on any device.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth?next=%2Fwishlist'
    );
    expect(getWishlist).not.toHaveBeenCalled();
  });

  it('renders the saved products when signed in', async () => {
    signIn();
    vi.mocked(getWishlist).mockResolvedValue([{ ...PRODUCT }]);
    renderWishlist();

    expect(await screen.findByRole('heading', { name: 'My Wishlist' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Luna Bed/ })).toBeInTheDocument();
    expect(screen.getByText('1 saved item')).toBeInTheDocument();
    expect(getWishlist).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when nothing is saved', async () => {
    signIn();
    renderWishlist();

    expect(await screen.findByText('No saved items yet.')).toBeInTheDocument();
    expect(
      screen.getByText('Tap the heart on any product to save it here.')
    ).toBeInTheDocument();
  });

  it('removes an item when its heart is clicked', async () => {
    signIn();
    vi.mocked(getWishlist).mockResolvedValue([{ ...PRODUCT }]);
    renderWishlist();

    const heart = await screen.findByRole('button', { name: 'Remove from wishlist' });
    fireEvent.click(heart);

    await waitFor(() => expect(removeWishlistItem).toHaveBeenCalledWith('luna-bed'));
    expect(await screen.findByText('No saved items yet.')).toBeInTheDocument();
    expect(screen.getByText('0 saved items')).toBeInTheDocument();
  });
});
