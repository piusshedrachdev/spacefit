import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders the migration placeholder heading inside the shared chrome', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: /spacefit/i, level: 1 })
    ).toBeInTheDocument();
    // Header brand from StorefrontLayout.
    expect(screen.getByAltText('SpaceFit Brand Logo')).toBeInTheDocument();
  });

  it('links back to the legacy site', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: /legacy site/i })).toHaveAttribute(
      'href',
      '/policies.html'
    );
  });
});
