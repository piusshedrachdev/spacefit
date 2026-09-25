import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';

/**
 * Static marketing homepage (port of space-fit2/frontend/index.html body):
 * section content, the hero carousel state machine (manual + 4s autoplay),
 * suggestion-pill quick-fill, the search action, and the SPA link wiring.
 */

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<div>shop page</div>} />
        <Route path="/seller-apply" element={<div>seller apply</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const slides = () => Array.from(document.querySelectorAll('[data-slide-index]'));
const dots = () => Array.from(document.querySelectorAll('[data-dot-index]'));

/** Index of the slide/dot currently in its "active" state (see reference JS). */
const activeSlide = () => slides().findIndex((node) => node.classList.contains('opacity-100'));
const activeDot = () => dots().findIndex((node) => node.classList.contains('w-6'));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('HomePage', () => {
  it('renders every reference section with its headline copy', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: /tell us what you need for your space/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Categories$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /in stock \(fast delivery\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your perfect space/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /have furniture to sell or relocate\?/i })
    ).toBeInTheDocument();
  });

  it('renders the 7 carousel slides with slide 0 and dot 0 active', () => {
    renderHome();

    expect(slides()).toHaveLength(7);
    expect(dots()).toHaveLength(7);
    expect(activeSlide()).toBe(0);
    expect(activeDot()).toBe(0);
  });

  it('advances to the next slide and wraps around from the last', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe(1);
    expect(activeDot()).toBe(1);

    // Wrap: 7 slides → clicking prev from 0 lands on the last one.
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlide()).toBe(6);
    expect(activeDot()).toBe(6);
  });

  it('jumps to a slide from its dot', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 5' }));
    expect(activeSlide()).toBe(4);
    expect(activeDot()).toBe(4);
  });

  it('auto-advances the carousel every 4 seconds', () => {
    vi.useFakeTimers();
    renderHome();
    expect(activeSlide()).toBe(0);

    act(() => vi.advanceTimersByTime(4000));
    expect(activeSlide()).toBe(1);

    act(() => vi.advanceTimersByTime(4000));
    expect(activeSlide()).toBe(2);
  });

  it('restarts the autoplay interval after a manual control press', () => {
    vi.useFakeTimers();
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe(1);

    // 3.9s after the manual press the timer must have restarted from zero.
    act(() => vi.advanceTimersByTime(3900));
    expect(activeSlide()).toBe(1);

    act(() => vi.advanceTimersByTime(100));
    expect(activeSlide()).toBe(2);
  });

  it('fills the search input when a suggestion pill is clicked', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /a desk for a small room/i }));

    const input = screen.getByPlaceholderText(/looking for/i) as HTMLInputElement;
    expect(input).toHaveValue('A desk for a small room');
    expect(document.activeElement).toBe(input);
  });

  it('hints instead of scrolling when "Find matches" is pressed empty', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /find matches/i }));

    const input = screen.getByPlaceholderText(/please type a piece or budget/i);
    expect(input).toHaveValue('');
  });

  it('scrolls to the categories section once a query is entered', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderHome();

    fireEvent.change(screen.getByPlaceholderText(/looking for/i), {
      target: { value: 'a desk for a small room' }
    });
    fireEvent.click(screen.getByRole('button', { name: /find matches/i }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    expect(document.getElementById('categories-section')).not.toBeNull();
  });

  it('renders the 6 categories and 4 featured products from the reference', () => {
    renderHome();

    const categoryGrid = document.getElementById('categories-section')!;
    expect(within(categoryGrid).getAllByRole('link')).toHaveLength(7); // 6 cards + "Explore all"
    expect(within(categoryGrid).getByRole('link', { name: /Beds/ })).toHaveTextContent('84 models');
    expect(within(categoryGrid).getByRole('link', { name: /Rugs/ })).toHaveTextContent('29 models');

    expect(document.querySelectorAll('[data-purpose="product-card"]')).toHaveLength(4);
    expect(screen.getByText('₦450,000')).toBeInTheDocument();
    expect(screen.getByText('₦180,000')).toBeInTheDocument();
    expect(screen.getByText('₦320,000')).toBeInTheDocument();
    expect(screen.getByText('₦150,000')).toBeInTheDocument();

    // Curated spaces: 3 scenario cards.
    expect(
      screen.getAllByRole('heading', {
        name: /furnish my bedroom|build my workspace|first apartment starter/i
      })
    ).toHaveLength(3);
  });

  it('wires placeholder links to the real SPA routes', () => {
    renderHome();

    expect(screen.getByRole('link', { name: /explore all/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /shop bedroom essentials/i })).toHaveAttribute(
      'href',
      '/shop'
    );
    expect(screen.getByRole('link', { name: /start selling today/i })).toHaveAttribute(
      'href',
      '/seller-apply'
    );
    expect(screen.getByRole('link', { name: /how selling works/i })).toHaveAttribute(
      'href',
      '/seller-apply'
    );
    // Every category card links into the catalogue.
    expect(screen.getAllByRole('link', { name: /models/i })).toHaveLength(6);
    screen
      .getAllByRole('link', { name: /models/i })
      .forEach((link) => expect(link).toHaveAttribute('href', '/shop'));
  });

  it('keeps the wishlist heart and add-to-cart controls on each featured card', () => {
    renderHome();

    expect(screen.getAllByRole('button', { name: /add .* to wishlist/i })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /add .* to cart/i })).toHaveLength(4);
  });
});
