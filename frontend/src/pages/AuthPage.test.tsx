import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { AppProviders } from '@/context/AppProviders';
import { DEV_USER_KEY, SESSION_KEY } from '@/lib/session';

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

import { getMe, login, signup } from '@/api/auth';
import { getConfig, getSettings } from '@/api/meta';
import { getNotifications } from '@/api/notifications';

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
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

function renderAuth(initial = '/auth') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProviders>
        <LocationProbe />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

/** Submit #authForm directly (the legacy form id) — mirrors clicking submit. */
function submitAuthForm() {
  fireEvent.submit(document.getElementById('authForm') as HTMLFormElement);
}

function fillCredentials(email = 'ada@spacefit.ng', password = 'password123') {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });

  // Signup adds a client-only confirmation field; keep the shared helper
  // useful for both modes without sending that value to the API.
  const confirmPassword = screen.queryByLabelText('Confirm password');
  if (confirmPassword) {
    fireEvent.change(confirmPassword, { target: { value: password } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSettings).mockReset().mockResolvedValue({ ...BASIC_SETTINGS });
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...BASIC_CONFIG });
  vi.mocked(getNotifications)
    .mockReset()
    .mockResolvedValue({ items: [], unreadCount: 0 });
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
  vi.mocked(login).mockReset();
  vi.mocked(signup).mockReset();
});

describe('AuthPage', () => {
  it('renders the sign-in form by default', async () => {
    renderAuth();
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' })
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to continue.')).toBeInTheDocument();
    // Signup-only fields are hidden in signin mode.
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    // Memory-mode demo chips (legacy #demoAccounts).
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seller' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customer' })).toBeInTheDocument();
  });

  it('switches between the sign-in and create-account forms', async () => {
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      screen.getByRole('heading', { name: 'Create your account' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(
      screen.getByText('Join SpaceFit to buy and sell furniture with confidence.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
  });

  it('toggles password visibility with accessible state', async () => {
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    const password = screen.getByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show' });

    expect(password).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('validates the signup password confirmation without sending it to the API', async () => {
    renderAuth('/auth?mode=signup');
    await screen.findByRole('heading', { name: 'Create your account' });

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@spacefit.ng' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different123' }
    });
    submitAuthForm();

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
    expect(signup).not.toHaveBeenCalled();
  });

  it('requires terms acceptance before creating an account', async () => {
    renderAuth('/auth?mode=signup');
    await screen.findByRole('heading', { name: 'Create your account' });

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@spacefit.ng' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password123' }
    });
    submitAuthForm();

    expect(
      await screen.findByText('Please accept the Terms of Service and Privacy Policy to continue.')
    ).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
    expect(screen.queryByText('Please accept the Terms of Service and Privacy Policy to continue.')).not.toBeInTheDocument();
  });

  it('moves focus to the first field after switching modes', async () => {
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Full name')));
  });

  it('validates email and password before calling the API', async () => {
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fillCredentials('not-an-email');
    submitAuthForm();
    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();

    fillCredentials('ada@spacefit.ng', 'short');
    submitAuthForm();
    expect(
      await screen.findByText('Password must be at least 8 characters.')
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows a busy label while the request is in flight', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {}));
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fillCredentials();
    submitAuthForm();

    const submit = document.getElementById('authSubmit') as HTMLButtonElement;
    expect(submit).toHaveTextContent('Signing in…');
    expect(submit).toBeDisabled();
  });

  it('signs in and continues to ?next=', async () => {
    vi.mocked(login).mockResolvedValue({ user: { id: 'u1' } });
    renderAuth('/auth?next=%2Fseller-apply');
    await screen.findByRole('heading', { name: 'Welcome back' });

    fillCredentials();
    submitAuthForm();

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/seller-apply')
    );
    expect(login).toHaveBeenCalledWith('ada@spacefit.ng', 'password123');
    expect(screen.getByTestId('elsewhere')).toBeInTheDocument();
  });

  it('surfaces sign-in errors from the API', async () => {
    vi.mocked(login).mockRejectedValue(new Error('Invalid credentials'));
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fillCredentials();
    submitAuthForm();

    expect(await screen.findByRole('status')).toHaveTextContent('Invalid credentials');
    expect(screen.getByTestId('location')).toHaveTextContent('/auth');
  });

  it('shows the confirmation notice and returns to sign-in after signup', async () => {
    vi.mocked(signup).mockResolvedValue({
      user: { id: 'u1' },
      needsEmailConfirmation: true
    });
    renderAuth('/auth?mode=signup');
    await screen.findByRole('heading', { name: 'Create your account' });

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: '  Ada Lovelace  ' }
    });
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '  +234 801 234 5678  ' }
    });
    fillCredentials();
    submitAuthForm();

    expect(signup).toHaveBeenCalledWith({
      email: 'ada@spacefit.ng',
      password: 'password123',
      fullName: 'Ada Lovelace',
      phone: '+234 801 234 5678',
      emailRedirectTo: expect.stringContaining('/auth.html')
    });
    expect(
      await screen.findByText(
        'Account created. Check your email to confirm, then sign in.'
      )
    ).toBeInTheDocument();
    // Back to the sign-in tab, no navigation taken.
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/auth?mode=signup');
    expect(login).not.toHaveBeenCalled();
  });

  it('continues after a regular signup', async () => {
    vi.mocked(signup).mockResolvedValue({ user: { id: 'u1' } });
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fillCredentials();
    submitAuthForm();

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    );
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@spacefit.ng', password: 'password123' })
    );
  });

  it('demo chips set the dev identity and continue to the target', async () => {
    renderAuth();
    await screen.findByRole('heading', { name: 'Welcome back' });

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    );
    expect(localStorage.getItem(DEV_USER_KEY)).toBe('dev-user-admin');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
