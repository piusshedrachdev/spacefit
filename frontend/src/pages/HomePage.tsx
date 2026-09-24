import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { bookConsultation } from '@/api/forms';
import { getCategories, getProducts } from '@/api/products';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { ProductGrid } from '@/components/commerce';
import { IfCan } from '@/components/Visibility';
import { useAsync } from '@/hooks';
import { Button, Input, Modal } from '@/ui';

/**
 * Home — port of legacy index.html + js/index.js: hero/search, catalogue
 * toolbar, filter sidebar, product grid, empty state, and the consultation
 * banner (rendered only for signed-in customers via <IfCan>, per
 * src/lib/permissions.ts — the legacy markup kept it permanently hidden).
 */

type PriceBracket = 'u100' | '100-250' | '250-500' | 'o500';

const PRICE_OPTIONS: Array<{ id: PriceBracket; label: string; bold?: boolean }> = [
  { id: 'u100', label: 'Under ₦100,000' },
  { id: '100-250', label: '₦100,000 – ₦250,000', bold: true },
  { id: '250-500', label: '₦250,000 – ₦500,000' },
  { id: 'o500', label: 'Above ₦500,000' }
];

const PRICE_BRACKETS: Record<PriceBracket, (price: number) => boolean> = {
  u100: (price) => price < 100000,
  '100-250': (price) => price >= 100000 && price < 250000,
  '250-500': (price) => price >= 250000 && price < 500000,
  o500: (price) => price >= 500000
};

export function HomePage() {
  const { toast } = useToast();
  const { profile, user } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [priceBracket, setPriceBracket] = useState<PriceBracket | null>(null);
  const [sort, setSort] = useState('recommended');

  const [consultOpen, setConsultOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [consultForm, setConsultForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: 'Lagos'
  });

  const productsQuery = useAsync(
    () => getProducts({ search: search || undefined, category: category || undefined }),
    [search, category]
  );
  const categoriesQuery = useAsync(() => getCategories(), []);

  const visibleProducts = useMemo(() => {
    let list = [...(productsQuery.data ?? [])];
    if (priceBracket) list = list.filter((product) => PRICE_BRACKETS[priceBracket](product.price));
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.reverse();
        break;
      default:
        break;
    }
    return list;
  }, [productsQuery.data, priceBracket, sort]);

  const scrollToShop = () => {
    document.getElementById('shop')?.scrollIntoView?.({ behavior: 'smooth' });
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory(null);
    setPriceBracket(null);
    setSort('recommended');
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    scrollToShop();
  };

  const openConsult = () => {
    // Prefill from the signed-in customer's profile ("who sees what").
    setConsultForm((current) => ({
      ...current,
      fullName: current.fullName || profile?.full_name || '',
      email: current.email || user?.email || '',
      phone: current.phone || profile?.phone || ''
    }));
    setConsultOpen(true);
  };

  const onConsultSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBooking(true);
    try {
      await bookConsultation({
        fullName: consultForm.fullName.trim(),
        email: consultForm.email.trim(),
        phone: consultForm.phone.trim(),
        city: consultForm.city.trim() || 'Lagos'
      });
      toast('Consultation booked! We will contact you within 24 hours.');
      setConsultOpen(false);
    } catch (err) {
      toast(`Booking failed: ${(err as Error).message}`, true);
    } finally {
      setBooking(false);
    }
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center p-space-2xl bg-surface-container-lowest rounded-xl shadow-sm text-center">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-space-md">
        <span className="material-symbols-outlined text-3xl">inventory_2</span>
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface">
        No matching spatial pieces found
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-space-xs">
        We couldn&apos;t locate any furniture matching these exact dimensions and budget criteria
        in the Lagos inventory.
      </p>
      <div className="flex items-center gap-space-sm mt-space-lg">
        <button
          type="button"
          onClick={resetFilters}
          className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-space-lg py-space-sm rounded-lg transition-colors"
        >
          Reset Filters
        </button>
        <IfCan rule="seeConsultation">
          <button
            type="button"
            onClick={openConsult}
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md px-space-lg py-space-sm rounded-lg transition-colors"
          >
            Talk to Spatial Concierge
          </button>
        </IfCan>
      </div>
    </div>
  );

  return (
    <div className="pb-space-2xl">
      {/* Explore header + editorial search */}
      <section className="w-full max-w-[1360px] mx-auto px-margin pt-space-xl pb-space-lg">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-space-sm">
          <h1 className="font-headline-lg text-headline-lg md:text-[40px] md:leading-[48px] text-on-surface tracking-tight">
            Explore Furniture &amp; Home Essentials
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Find pieces that fit your space, style and budget. Precision-proportioned for
            deliberate everyday harmony.
          </p>
        </div>
        <form className="mt-space-xl max-w-3xl mx-auto" role="search" onSubmit={onSearch}>
          <div className="relative flex items-center bg-surface-container-lowest rounded-xl shadow-md p-space-xs transition-shadow duration-300 focus-within:shadow-xl">
            <div className="pl-space-md pr-space-xs flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-2xl">search</span>
            </div>
            <input
              className="w-full bg-transparent py-space-sm px-space-xs font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              id="catalogueSearch"
              placeholder="Search furniture, mattresses, desks, or try 'Furnish my bedroom under ₦500K'..."
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput ? (
              <button
                type="button"
                title="Clear search"
                aria-label="Clear search"
                className="text-outline hover:text-on-surface p-space-xs transition-colors"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                }}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {/* Catalogue toolbar */}
      <section className="w-full max-w-[1360px] mx-auto px-margin py-space-sm mb-space-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-low/70 p-space-md rounded-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              Showing <span className="font-bold text-primary">{visibleProducts.length}</span>{' '}
              pieces
            </span>
            <span className="hidden sm:inline-block text-outline text-xs">•</span>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-space-md">
            <div className="relative flex items-center">
              <label className="sr-only" htmlFor="sortDropdown">
                Sort pieces
              </label>
              <div className="flex items-center bg-surface-container-lowest px-space-md py-space-xs rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-outline text-base mr-1">
                  sort
                </span>
                <select
                  className="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer pr-space-xs"
                  id="sortDropdown"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recommended">Sort by: Recommended</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest Additions</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sidebar + catalogue */}
      <div id="shop" className="w-full max-w-[1360px] mx-auto px-margin pb-space-2xl scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          <aside className="lg:col-span-3 sticky top-24 space-y-space-lg bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-xl">tune</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Filters</h2>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="font-label-sm text-label-sm text-primary hover:text-primary-container font-semibold transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Categories (live from /api/products/categories) */}
            <div className="space-y-space-sm pt-space-xs">
              <div className="flex items-center justify-between cursor-pointer">
                <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface">
                  Categories
                </span>
                <span className="material-symbols-outlined text-base text-outline">
                  expand_less
                </span>
              </div>
              <div className="space-y-2 pt-1">
                {(categoriesQuery.data ?? []).map((cat) => {
                  const active = category === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(active ? null : cat.name)}
                      className={`block w-full text-left px-space-sm py-space-xs rounded transition-colors text-body-sm font-body-sm ${
                        active
                          ? 'bg-surface-container text-on-surface font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      {cat.name} <span className="text-outline">({cat.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price range (radios filter the loaded list client-side) */}
            <div className="space-y-space-sm pt-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface">
                  Price Range
                </span>
                <span className="font-label-sm text-label-sm text-primary font-semibold">
                  ₦ NGN
                </span>
              </div>
              <div className="space-y-2 pt-1">
                {PRICE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-space-xs cursor-pointer text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface"
                  >
                    <input
                      className="text-primary accent-primary cursor-pointer"
                      type="radio"
                      name="price_bracket"
                      checked={priceBracket === option.id}
                      onChange={() => setPriceBracket(option.id)}
                    />
                    <span className={option.bold ? 'font-semibold' : undefined}>
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="pt-space-sm space-y-2">
                <div className="relative h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className="absolute left-[15%] right-[30%] top-0 bottom-0 bg-primary rounded-full" />
                </div>
                <div className="flex items-center justify-between text-[11px] font-label-sm text-outline">
                  <span>Min: ₦50,000</span>
                  <span>Max: ₦1,200,000</span>
                </div>
                <div className="grid grid-cols-2 gap-space-xs pt-1">
                  <div className="bg-surface-container-low px-2 py-1 rounded">
                    <span className="block text-[10px] text-outline">From</span>
                    <span className="font-price-md text-price-md text-on-surface text-xs">
                      {priceBracket && priceBracket !== 'o500' && priceBracket !== 'u100'
                        ? priceBracket === '100-250'
                          ? '₦100,000'
                          : '₦250,000'
                        : '₦100,000'}
                    </span>
                  </div>
                  <div className="bg-surface-container-low px-2 py-1 rounded">
                    <span className="block text-[10px] text-outline">To</span>
                    <span className="font-price-md text-price-md text-on-surface text-xs">
                      {priceBracket === 'u100'
                        ? '₦99,999'
                        : priceBracket === '100-250'
                          ? '₦249,999'
                          : priceBracket === '250-500'
                            ? '₦499,999'
                            : '₦500,000+'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Space Fit Proportion (decorative — no dimension data yet, as in legacy) */}
            <div className="space-y-space-sm pt-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface">
                  Space Fit Proportion
                </span>
                <span
                  className="material-symbols-outlined text-primary text-sm"
                  title="Guaranteed door frame and room footprint compatibility"
                >
                  straighten
                </span>
              </div>
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-space-xs cursor-pointer group">
                  <input
                    defaultChecked
                    className="mt-1 w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                    type="checkbox"
                  />
                  <div className="flex flex-col">
                    <span className="text-body-sm font-body-sm text-on-surface group-hover:text-primary transition-colors">
                      Compact / Studio Fit
                    </span>
                    <span className="text-[11px] text-outline">
                      For rooms under 18 sqm with narrow corridors
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-space-xs cursor-pointer group">
                  <input
                    defaultChecked
                    className="mt-1 w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                    type="checkbox"
                  />
                  <div className="flex flex-col">
                    <span className="text-body-sm font-body-sm text-on-surface group-hover:text-primary transition-colors">
                      Standard Bedroom
                    </span>
                    <span className="text-[11px] text-outline">
                      18 – 32 sqm master and guest apartments
                    </span>
                  </div>
                </label>
                <label className="flex items-start gap-space-xs cursor-pointer group">
                  <input
                    className="mt-1 w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                    type="checkbox"
                  />
                  <div className="flex flex-col">
                    <span className="text-body-sm font-body-sm text-on-surface group-hover:text-primary transition-colors">
                      Spacious Living
                    </span>
                    <span className="text-[11px] text-outline">
                      High-ceilinged duplexes and grand lofts
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Availability (decorative, as in legacy) */}
            <div className="space-y-space-sm pt-space-xs">
              <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface block">
                Availability
              </span>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-space-xs cursor-pointer text-body-sm font-body-sm text-on-surface">
                  <input defaultChecked className="w-4 h-4 rounded text-primary accent-primary" type="checkbox" />
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    In Stock (Fast Delivery)
                  </span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface">
                  <input className="w-4 h-4 rounded text-primary accent-primary" type="checkbox" />
                  <span>Pre-order Handcraft</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface">
                  <input className="w-4 h-4 rounded text-primary accent-primary" type="checkbox" />
                  <span>Ready to Assemble</span>
                </label>
              </div>
            </div>

            <div className="pt-space-sm space-y-space-xs">
              <button
                type="button"
                onClick={scrollToShop}
                className="w-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-space-sm rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-space-xs"
              >
                <span>Apply Filters ({visibleProducts.length})</span>
                <span className="material-symbols-outlined text-base">check</span>
              </button>
            </div>
          </aside>

          <section className="lg:col-span-9" aria-label="Product catalogue">
            <ProductGrid
              products={visibleProducts}
              loading={productsQuery.loading}
              empty={emptyState}
            />

            {/* Consultation banner — signed-in customers only (see permissions.ts) */}
            <IfCan rule="seeConsultation">
              <section className="mt-space-2xl bg-surface-container-low rounded-xl p-space-xl relative overflow-hidden shadow-sm">
                <div className="relative z-10 max-w-lg space-y-space-sm">
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold block">
                    SpaceFit In-Home Consult
                  </span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Uncertain if standard proportions fit your floorplan?
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Upload your architectural room blueprint or smartphone scan. Our spatial
                    interior architects in Lagos provide 3D clearance simulations within 24 hours.
                  </p>
                  <div className="pt-space-xs">
                    <button
                      type="button"
                      data-book-consultation
                      onClick={openConsult}
                      className="bg-inverse-surface text-inverse-on-surface hover:bg-on-surface font-label-md text-label-md px-space-lg py-space-sm rounded-lg shadow-sm transition-all duration-200"
                    >
                      Book Spatial Measurement (Free)
                    </button>
                  </div>
                </div>
              </section>
            </IfCan>
          </section>
        </div>
      </div>

      {/* Consultation modal (replaces the legacy prompt() chain) */}
      <Modal
        open={consultOpen}
        title="Book a Spatial Consultation"
        onClose={() => setConsultOpen(false)}
      >
        <form className="space-y-space-md" onSubmit={onConsultSubmit}>
          <Input
            label="Full name"
            required
            autoComplete="name"
            value={consultForm.fullName}
            onChange={(event) =>
              setConsultForm((current) => ({ ...current, fullName: event.target.value }))
            }
          />
          <Input
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={consultForm.email}
            onChange={(event) =>
              setConsultForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <Input
            label="Phone number"
            type="tel"
            required
            autoComplete="tel"
            value={consultForm.phone}
            onChange={(event) =>
              setConsultForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
          <Input
            label="City"
            value={consultForm.city}
            onChange={(event) =>
              setConsultForm((current) => ({ ...current, city: event.target.value }))
            }
          />
          <Button type="submit" block disabled={booking}>
            {booking ? 'Booking…' : 'Book Consultation'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
