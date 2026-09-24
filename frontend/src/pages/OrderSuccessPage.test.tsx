import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrderSuccessPage } from '@/pages/OrderSuccessPage';
import { AppProviders } from '@/context/AppProviders';
import type { Order } from '@/types/api';

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
vi.mock('@/api/orders', () => ({
  placeOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn()
}));

import { getConfig, getSettings } from '@/api/meta';
import { getOrder } from '@/api/orders';

const ORDER: Order = {
  id: 'o1',
  reference: 'SF-1001',
  status: 'pending',
  items: [
    {
      productId: 'luna-bed',
      name: 'Luna Bed',
      price: 450000,
      quantity: 1,
      size: 'Queen',
      color: 'Walnut',
      image: '/img/luna.jpg'
    }
  ],
  customer: { fullName: 'Ada', email: 'ada@example.com', phone: '0801112233' },
  delivery: { address: '12 Bourdillon Road', city: 'Lagos', state: 'Lagos' },
  paymentMethod: 'card',
  notes: null,
  currency: 'NGN',
  subtotal: 450000,
  deliveryFee: 0,
  vat: 0,
  total: 780000,
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
  serviceableCities: ['Lagos'],
  paymentMethods: [{ id: 'card', label: 'Card' }]
};

function renderSuccess(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <Routes>
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getOrder).mockReset().mockResolvedValue({ ...ORDER });
});

describe('OrderSuccessPage', () => {
  it('loads the real order and lists its items when an id is present', async () => {
    renderSuccess('/order-success/o1');

    expect(
      await screen.findByRole('heading', { name: 'Order placed successfully!', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('#SF-1001')).toBeInTheDocument();
    expect(screen.getByText('\u20a6780,000')).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith('o1');

    // Item list.
    expect(screen.getByRole('heading', { name: 'Order Items', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Luna Bed')).toBeInTheDocument();
  });

  it('shows the static confirmation without an order id (legacy default)', async () => {
    renderSuccess('/order-success');

    expect(await screen.findByText('#SF123456')).toBeInTheDocument();
    expect(screen.getByText('\u20a6780,000')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Order Items' })).not.toBeInTheDocument();
    expect(getOrder).not.toHaveBeenCalled();
  });
});
