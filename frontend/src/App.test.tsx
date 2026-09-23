import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders the migration placeholder heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /spacefit/i })).toBeInTheDocument();
  });

  it('links back to the legacy site', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /legacy site/i })).toHaveAttribute(
      'href',
      '/policies.html'
    );
  });
});
