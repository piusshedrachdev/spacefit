import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { AppProviders } from '@/context/AppProviders';
import { ToastHost } from '@/layout/Chrome';
import { setSession } from '@/lib/session';
import type { Cart, Order, Profile } from '@/types/api';

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
vi.mock('@/api/orders', () => ({
  placeOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn()
}));

import { ensureCart } from '@/api/cart';
import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getOrder, getOrders, placeOrder } from '@/api/orders';

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

const ORDER: Order = {
  id: 'o9',
  reference: 'SF-9',
  status: 'pending',
  items: [
    {
      productId: 'luna-bed',
      name: 'Luna Bed',
      price: 450000,
      quantity: 1,
      size: 'Queen',
      color: null
    }
  ],
  customer: { fullName: 'Chidi Guest', email: 'chidi@example.com', phone: '0801112233' },
  delivery: { address: '12 Bourdillon Road', city: 'Lagos', state: 'Lagos' },
  paymentMethod: 'card',
  notes: null,
  currency: 'NGN',
  subtotal: 450000,
  deliveryFee: 0,
  vat: 0,
  total: 450000,
  createdAt: '2026-01-01T10:00:00.000Z'
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
  serviceableCities: ['Lagos', 'Abuja'],
  paymentMethods: [
    { id: 'card', label: 'Card' },
    { id: 'transfer', label: 'Transfer' }
  ]
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderCheckout(initial = '/checkout') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <ToastHost />
        <LocationProbe />
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-success/:id" element={<div data-testid="success-page" />} />
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
  vi.mocked(ensureCart).mockReset().mockResolvedValue({ ...CART });
  vi.mocked(placeOrder).mockReset().mockResolvedValue({ ...ORDER });
  vi.mocked(getOrder).mockReset().mockResolvedValue({ ...ORDER });
  vi.mocked(getOrders).mockReset().mockResolvedValue([{ ...ORDER }]);
});

describe('CheckoutPage', () => {
  it('prefills the customer fields for a signed-in customer', async () => {
    const user = { id: 'u1', email: 'ada@spacefit.ng' };
    const profile: Profile = {
      id: 'u1',
      role: 'customer',
      full_name: 'Ada Customer',
      phone: '+234 801 234 5678'
    };
    setSession({ accessToken: 't', refreshToken: 'r', user, profile: null });
    vi.mocked(getMe).mockImplementation(async () => {
      setSession({ accessToken: 't', refreshToken: 'r', user, profile });
      return { user, profile };
    });

    renderCheckout();

    expect(await screen.findByDisplayValue('Ada Customer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ada@spacefit.ng')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+234 801 234 5678')).toBeInTheDocument();
  });

  it('offers the configured payment methods with card preselected', async () => {
    renderCheckout();

    expect(await screen.findByText('Bank Transfer')).toBeInTheDocument();
    expect(screen.getByText('Card (Visa, Mastercard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Card (Visa, Mastercard)')).toBeChecked();
  });

  it('places a guest order and lands on the confirmation route', async () => {
    renderCheckout();

    fireEvent.change(await screen.findByLabelText('Full name'), {
      target: { value: 'Chidi Guest' }
    });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'chidi@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '0801112233' }
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: '12 Bourdillon Road' }
    });

    const place = await screen.findByRole('button', { name: 'Place Order' });
    await waitFor(() => expect(place).toBeEnabled());
    fireEvent.click(place);

    await vi.waitFor(() =>
      expect(placeOrder).toHaveBeenCalledWith({
        cartId: 'c1',
        customer: {
          fullName: 'Chidi Guest',
          email: 'chidi@example.com',
          phone: '0801112233'
        },
        delivery: {
          address: '12 Bourdillon Road',
          city: 'Lagos',
          state: 'Lagos',
          instructions: ''
        },
        paymentMethod: 'card'
      })
    );
    expect(await screen.findByTestId('success-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/order-success/o9');
  });

  it('blocks ordering with an empty cart and shows a toast', async () => {
    vi.mocked(ensureCart).mockResolvedValue({ ...EMPTY });
    renderCheckout();

    const place = await screen.findByRole('button', { name: 'Place Order' });
    await waitFor(() => expect(place).toBeEnabled());
    fireEvent.click(place);

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Your cart is empty.');
    expect(placeOrder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('success-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout');
  });
});
