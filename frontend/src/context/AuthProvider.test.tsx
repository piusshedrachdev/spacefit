import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthProvider';
import { getDevUser, getSession, setDevUser, setSession } from '@/lib/session';
import type { Role } from '@/types/api';

vi.mock('@/api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn()
}));

import * as authService from '@/api/auth';

/** Probe that surfaces the auth context to assertions. */
function Probe() {
  const { status, isAuthenticated, role, profile } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="profile-name">{profile?.full_name ?? ''}</span>
    </div>
  );
}

function LogoutProbe() {
  const { logout } = useAuth();
  return <button onClick={() => void logout()} type="button">Sign out</button>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authService.getMe).mockReset();
});

describe('AuthProvider', () => {
  it('starts signed out without calling the API', async () => {
    renderAuth();

    await screen.findByText('ready');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('role')).toHaveTextContent('customer');
    expect(authService.getMe).not.toHaveBeenCalled();
  });

  it('uses the profile role once getMe resolves', async () => {
    setSession({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'admin@spacefit.ng' },
      profile: null
    });
    // The real getMe persists the fetched profile; simulate that side effect.
    vi.mocked(authService.getMe).mockImplementation(async () => {
      setSession({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: 'u1', email: 'admin@spacefit.ng' },
        profile: { id: 'u1', role: 'admin', full_name: 'Ada Admin' }
      });
      return {
        user: { id: 'u1', email: 'admin@spacefit.ng' },
        profile: { id: 'u1', role: 'admin', full_name: 'Ada Admin' }
      };
    });

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin'));
    await screen.findByText('ready');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Ada Admin');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
  });

  it('maps memory-mode dev identities to roles', async () => {
    setDevUser('dev-user-admin');
    vi.mocked(authService.getMe).mockResolvedValue({
      user: { id: 'dev-user-admin' },
      profile: null
    });

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
  });

  it('keeps working when getMe fails (expired/invalid session)', async () => {
    setSession({
      accessToken: 'expired',
      refreshToken: 'refresh',
      user: { id: 'u1' },
      profile: null
    });
    vi.mocked(authService.getMe).mockRejectedValue(new Error('401'));

    renderAuth();

    await screen.findByText('ready');
    // Still signed in based on the stored session; no crash.
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('role')).toHaveTextContent('customer');
  });

  it('clears a memory-mode identity when signing out', async () => {
    setDevUser('dev-user-admin');
    vi.mocked(authService.getMe).mockResolvedValue({
      user: { id: 'dev-user-admin' },
      profile: null
    });

    render(
      <AuthProvider>
        <Probe />
        <LogoutProbe />
      </AuthProvider>
    );

    await screen.findByText('ready');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'));
    expect(screen.getByTestId('role')).toHaveTextContent('customer');
    expect(getDevUser()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('exposes the resolved Role type union', async () => {
    const roles: Role[] = ['admin', 'seller', 'customer'];
    expect(roles).toHaveLength(3);
  });
});
