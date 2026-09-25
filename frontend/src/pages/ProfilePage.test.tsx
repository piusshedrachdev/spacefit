import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfilePage } from '@/pages/ProfilePage';
import { AppProviders } from '@/context/AppProviders';
import { setSession } from '@/lib/session';
import type { Order, Profile, Role } from '@/types/api';

vi.mock('@/api/orders', () => ({
  getMyOrders: vi.fn()
}));

vi.mock('@/api/wishlist', () => ({
  getWishlist: vi.fn(),
  addWishlistItem: vi.fn(),
  removeWishlistItem: vi.fn()
}));

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

import { updateMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getNotifications } from '@/api/notifications';
import { getMyOrders } from '@/api/orders';
import { getWishlist } from '@/api/wishlist';

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
  currencySymbol: '₦',
  deliveryFee: 15000,
  freeDeliveryThreshold: 500000,
  vatRate: 0.075,
  serviceableCities: ['Lagos'],
  paymentMethods: [{ id: 'card', label: 'Card' }]
};

const ORDER: Order = {
  id: 'order-1',
  reference: 'SF-BUYER01',
  status: 'delivered',
  items: [
    {
      productId: 'luna-bed',
      name: 'Luna Bed',
      price: 450000,
      quantity: 1,
      size: null,
      color: null
    }
  ],
  customer: { fullName: 'Ada Buyer', email: 'ada@example.com', phone: '+2348000000000' },
  delivery: { address: '14 Admiralty Way', city: 'Lagos', state: 'Lagos' },
  paymentMethod: 'card',
  notes: null,
  currency: 'NGN',
  subtotal: 450000,
  deliveryFee: 15000,
  vat: 33750,
  total: 498750,
  createdAt: '2026-01-10T10:00:00.000Z'
};

function signIn(role: Role = 'customer') {
  const profile: Profile = {
    id: 'u1',
    role,
    full_name: role === 'seller' ? 'Tolu Seller' : 'Ada Buyer',
    phone: '+2348000000000',
    created_at: '2025-01-01T00:00:00.000Z'
  };
  setSession({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: 'u1', email: 'ada@example.com' },
    profile
  });
}

function renderProfile(initial = '/profile') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:tab" element={<ProfilePage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getNotifications)
    .mockReset()
    .mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getWishlist).mockReset().mockResolvedValue([]);
  vi.mocked(getMyOrders).mockReset().mockResolvedValue([]);
  vi.mocked(updateMe).mockReset();
  signIn();
});

describe('ProfilePage', () => {
  it('renders a buyer summary and profile sections', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Ada Buyer' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/profile/orders');
    expect(screen.getByRole('link', { name: 'Saved items' })).toHaveAttribute('href', '/profile/saved');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/profile/settings');
    expect(screen.queryByRole('link', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('shows the signed-in buyer orders', async () => {
    vi.mocked(getMyOrders).mockResolvedValue([ORDER]);
    renderProfile('/profile/orders');

    expect(await screen.findByText(/SF-BUYER01/)).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
    expect(screen.getByText('₦498,750')).toBeInTheDocument();
  });

  it('saves personal details through the auth profile endpoint', async () => {
    const updatedProfile: Profile = {
      id: 'u1',
      role: 'customer',
      full_name: 'Ada Updated',
      phone: '+2348000000001'
    };
    vi.mocked(updateMe).mockResolvedValue(updatedProfile);
    renderProfile('/profile/settings');

    fireEvent.change(await screen.findByLabelText('Full name'), {
      target: { value: '  Ada Updated  ' }
    });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: ' +2348000000001 ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({
        fullName: 'Ada Updated',
        phone: '+2348000000001'
      })
    );
    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument();
  });

  it('shows seller tools for a seller profile', async () => {
    signIn('seller');
    renderProfile('/profile/settings');

    expect(await screen.findByText('Seller dashboard')).toBeInTheDocument();
    expect(screen.getByText('Shop profile')).toBeInTheDocument();
    expect(screen.queryByText('Become a seller')).not.toBeInTheDocument();
  });
});
