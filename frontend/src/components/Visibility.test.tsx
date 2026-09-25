import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppProviders } from '@/context/AppProviders';
import { AuthOnly, GuestOnly, IfCan, RequireAuth, RequireRole, RoleOnly } from '@/components/Visibility';
import { setSession } from '@/lib/session';
import type { Profile, Role } from '@/types/api';

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

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

/** Render `element` at /gated with the full provider stack + a route table
 * that can observe the RequireRole redirect to the auth page. */
function renderGated(element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/gated']}>
      <AppProviders>
        <Routes>
          <Route path="/gated" element={element} />
          <Route path="/auth" element={<LocationProbe />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

/** Sign in with a profile role (getMe persists the profile, like the real client). */
function signIn(role: Role, fullName = 'Test User') {
  const user = { id: 'u1', email: 'user@spacefit.ng' };
  const profile: Profile = { id: 'u1', role, full_name: fullName };
  setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile: null });
  vi.mocked(getMe).mockImplementation(async () => {
    setSession({ accessToken: 'token', refreshToken: 'refresh', user, profile });
    return { user, profile };
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getMe).mockReset().mockRejectedValue(new Error('signed out'));
});

describe('AuthOnly / GuestOnly', () => {
  it('renders children only for guests', async () => {
    renderGated(
      <>
        <AuthOnly>
          <span>signed-in content</span>
        </AuthOnly>
        <GuestOnly>
          <span>guest content</span>
        </GuestOnly>
      </>
    );
    expect(await screen.findByText('guest content')).toBeInTheDocument();
    expect(screen.queryByText('signed-in content')).not.toBeInTheDocument();
  });

  it('flips once the visitor signs in', async () => {
    signIn('customer', 'Ada');
    renderGated(
      <>
        <AuthOnly>
          <span>signed-in content</span>
        </AuthOnly>
        <GuestOnly>
          <span>guest content</span>
        </GuestOnly>
      </>
    );
    expect(await screen.findByText('signed-in content')).toBeInTheDocument();
    expect(screen.queryByText('guest content')).not.toBeInTheDocument();
  });
});

describe('RoleOnly', () => {
  it('renders role-scoped content for the matching role only', async () => {
    signIn('admin', 'Ada Admin');
    renderGated(
      <>
        <RoleOnly roles={['admin']}>
          <span>admin area</span>
        </RoleOnly>
        <RoleOnly roles={['seller']}>
          <span>seller area</span>
        </RoleOnly>
      </>
    );
    expect(await screen.findByText('admin area')).toBeInTheDocument();
    expect(screen.queryByText('seller area')).not.toBeInTheDocument();
  });
});

describe('IfCan', () => {
  it('hides the seller pitch from existing sellers', async () => {
    signIn('seller', 'Sam Seller');
    renderGated(
      <IfCan rule="applyAsSeller">
        <span>become a seller</span>
      </IfCan>
    );
    // Wait for auth to settle, then confirm the rule kept it hidden.
    await vi.waitFor(() => expect(screen.queryByText('become a seller')).toBeNull());
  });

  it('shows the seller pitch to customers', async () => {
    signIn('customer', 'Ada');
    renderGated(
      <IfCan rule="applyAsSeller">
        <span>become a seller</span>
      </IfCan>
    );
    expect(await screen.findByText('become a seller')).toBeInTheDocument();
  });
});

describe('RequireAuth', () => {
  it('redirects signed-out visitors to auth instead of rendering a gate', async () => {
    renderGated(
      <RequireAuth>
        <span>protected content</span>
      </RequireAuth>
    );

    const location = await screen.findByTestId('location');
    expect(location).toHaveTextContent('/auth?next=%2Fgated');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});

describe('RequireRole', () => {
  it('redirects signed-out visitors to the auth page with ?next=', async () => {
    renderGated(
      <RequireRole roles={['admin']}>
        <span>secret</span>
      </RequireRole>
    );
    const location = await screen.findByTestId('location');
    expect(location).toHaveTextContent('/auth?next=%2Fgated');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('shows the access-denied panel for the wrong role', async () => {
    signIn('customer', 'Ada');
    renderGated(
      <RequireRole roles={['admin']}>
        <span>secret</span>
      </RequireRole>
    );
    expect(
      await screen.findByText("You don't have access to this area")
    ).toBeInTheDocument();
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children for an allowed role', async () => {
    signIn('admin', 'Ada Admin');
    renderGated(
      <RequireRole roles={['admin', 'seller']}>
        <span>dashboard body</span>
      </RequireRole>
    );
    expect(await screen.findByText('dashboard body')).toBeInTheDocument();
  });
});
