import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthLayout } from '@/layout/AuthLayout';

vi.mock('@/layout/Chrome', () => ({
  ToastHost: () => <div data-testid="toast-host" />
}));

describe('AuthLayout', () => {
  it('renders the standalone split auth shell with a home-linked brand', () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AuthLayout>
          <div data-testid="auth-content">Auth form</div>
        </AuthLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('auth-content')).toBeInTheDocument();
    expect(screen.getByTestId('toast-host')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SpaceFit/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('complementary', { name: 'About SpaceFit' })).toBeInTheDocument();
    expect(screen.getByText('Furniture that fits your space, from people who share it.')).toBeInTheDocument();
    expect(screen.getByText('Amaka O., Port Harcourt')).toBeInTheDocument();
    expect(screen.queryByText('Back to store')).not.toBeInTheDocument();
  });
});
