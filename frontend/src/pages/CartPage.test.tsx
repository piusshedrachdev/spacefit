import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CartPage } from '@/pages/CartPage';
import { AppProviders } from '@/context/AppProviders';
import { ToastHost } from '@/layout/Chrome';
import type { Cart } from '@/types/api';

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

import {
  ensureCart,
  removeCartItem,
  updateCartItem
} from '@/api/cart';
import { getConfig, getSettings } from '@/api/meta';

const ITEM = {
  key: 'k1',
  productId: 'luna-bed',
  name: 'Luna Bed',
  price: 450000,
  image: null,
  quantity: 1,
  size: 'Queen',
  color: null
};

const CART: Cart = {
  id: 'c1',
  items: [{ ...ITEM }],
  itemCount: 1,
  currency: 'NGN',
  subtotal: 450000,
  delivery: 0,
  vat: 0,
  total: 450000
};

const UPDATED: Cart = {
  ...CART,
  items: [{ ...ITEM, quantity: 2 }],
  itemCount: 2,
  subtotal: 900000,
  total: 900000
};

const EMPTY: Cart = {
  id: 'c1',
  items: [],
  itemCount: 0,
  currency: 'NGN',
  subtotal: 0,
  delivery: 0,
  vat: 0,
  total: 0
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

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderCart(initial = '/cart') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <ToastHost />
        <LocationProbe />
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<div data-testid="checkout-page" />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(ensureCart).mockReset().mockResolvedValue({ ...CART });
  vi.mocked(updateCartItem).mockReset().mockResolvedValue({ ...UPDATED });
  vi.mocked(removeCartItem).mockReset().mockResolvedValue({ ...EMPTY });
});

describe('CartPage', () => {
  it('renders the line items and the order summary', async () => {
    renderCart();

    expect(await screen.findByText('Luna Bed')).toBeInTheDocument();
    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order Summary' })).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    // Line total + subtotal + total all show the money format.
    expect(screen.getAllByText('\u20a6450,000').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeInTheDocument();
    expect(ensureCart).toHaveBeenCalled();
  });

  it('updates the quantity through the server cart', async () => {
    renderCart();
    await screen.findByText('Luna Bed');

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await vi.waitFor(() =>
      expect(updateCartItem).toHaveBeenCalledWith('c1', 'k1', 2)
    );
    // The refreshed cart totals re-render (line + subtotal + total).
    expect((await screen.findAllByText('\u20a6900,000')).length).toBeGreaterThan(0);
  });

  it('removes a line through the server cart', async () => {
    renderCart();
    await screen.findByText('Luna Bed');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Luna Bed' }));

    await vi.waitFor(() => expect(removeCartItem).toHaveBeenCalledWith('c1', 'k1'));
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
  });

  it('navigates to checkout when the cart has items', async () => {
    renderCart();
    await screen.findByText('Luna Bed');

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/ }));

    expect(await screen.findByTestId('checkout-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout');
  });

  it('blocks checkout with an empty cart and shows a toast', async () => {
    vi.mocked(ensureCart).mockResolvedValue({ ...EMPTY });
    renderCart();

    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/ }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Your cart is empty.');
    // Stayed on the cart.
    expect(screen.queryByTestId('checkout-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/cart');
  });
});
