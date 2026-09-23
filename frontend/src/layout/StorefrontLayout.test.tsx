import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontLayout } from '@/layout/StorefrontLayout';
import { AppProviders } from '@/context/AppProviders';
import { setSession } from '@/lib/session';

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

import { getMe } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getNotifications } from '@/api/notifications';

const BASIC_SETTINGS = {
  policies: {
    returnPolicy: 'r',
    sellerPolicy: 's',
    deliveryPolicy: 'd',
    privacyPolicy: 'p'
  },
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

function renderLayout() {
  return render(
    <MemoryRouter>
      <AppProviders>
        <StorefrontLayout>
          <div data-testid="page-body">page content</div>
        </StorefrontLayout>
      </AppProviders>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getNotifications).mockReset().mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getMe).mockReset().mockImplementation(async () => {
    throw new Error('not signed in');
  });
});

describe('StorefrontLayout (signed out)', () => {
  it('renders the header, footer policy links and page body', async () => {
    renderLayout();

    expect(screen.getByTestId('page-body')).toBeInTheDocument();
    // Sign-in control (aria label from chrome.js).
    expect(await screen.findByLabelText('Sign in')).toHaveAttribute('href', 'auth.html');
    // chrome.js footer policy links.
    expect(screen.getByRole('link', { name: 'Policies' })).toHaveAttribute(
      'href',
      'policies.html'
    );
    expect(screen.getByRole('link', { name: 'Returns' })).toHaveAttribute(
      'href',
      'policies.html#returns'
    );
    // No notification bell when signed out.
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument();
  });

  it('does not show the discount banner when disabled', async () => {
    renderLayout();
    expect(await screen.findByTestId('page-body')).toBeInTheDocument();
    expect(screen.queryByText(/off sitewide/)).not.toBeInTheDocument();
  });
});

describe('StorefrontLayout (signed in)', () => {
  it('shows the account menu with the role dashboard link and the bell', async () => {
    setSession({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'ada@spacefit.ng' },
      profile: { id: 'u1', role: 'admin', full_name: 'Ada Admin' }
    });
    vi.mocked(getMe).mockResolvedValue({
      user: { id: 'u1', email: 'ada@spacefit.ng' },
      profile: { id: 'u1', role: 'admin', full_name: 'Ada Admin' }
    });
    vi.mocked(getNotifications).mockResolvedValue({
      items: [
        {
          id: 'n1',
          userId: 'u1',
          type: 'application_reviewed',
          title: 'Application approved',
          body: null,
          link: 'admin.html#applications',
          readAt: null,
          createdAt: new Date().toISOString()
        }
      ],
      unreadCount: 7
    });

    renderLayout();

    // Bell with unread badge (links to the notifications tab, like chrome.js).
    const bell = await screen.findByLabelText('Notifications');
    expect(bell).toHaveAttribute('href', 'seller-dashboard.html#notifications');
    expect(await screen.findByText('7')).toBeInTheDocument();

    // Open the account menu.
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin dashboard')).toHaveAttribute('href', 'admin.html');
    expect(screen.getByText('Become a Seller')).toHaveAttribute(
      'href',
      'seller-apply.html'
    );
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });
});

describe('StorefrontLayout (discount banner)', () => {
  it('renders the banner when settings enable it', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...BASIC_SETTINGS,
      discounts: {
        sitewidePercent: 50,
        promoCode: 'SAVE50',
        freeDeliveryThreshold: 500000,
        bannerEnabled: true
      }
    });

    renderLayout();

    expect(await screen.findByText(/50% off sitewide/)).toBeInTheDocument();
    expect(screen.getByText(/code SAVE50/)).toBeInTheDocument();
  });
});
