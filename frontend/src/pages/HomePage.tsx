import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';

/**
 * Home — the marketing homepage, a static port of the reference prototype
 * (space-fit2/frontend/index.html body: hero carousel + smart search,
 * categories, in-stock products, curated spaces, seller CTA).
 *
 * Content is intentionally static (exact copy/prices/images from the
 * reference); the catalogue with live API data lives in ShopPage at `/shop`.
 * Behaviours come from the reference script.js: 4s carousel autoplay that
 * restarts on manual interaction, suggestion-pill quick-fill, and the
 * "Find matches" scroll-to-categories.
 *
 * The shared chrome (DiscountBanner / Header / Footer) is unchanged — only the
 * page body is ported, per the implementation plan.
 */

type Slide = {
  image: string;
  alt: string;
  title: string;
  caption: string;
  price: string;
};

const SLIDES: Slide[] = [
  {
    image: '/assets/carousell/contemporary-living-room-design.jpg',
    alt: 'Contemporary Living Room Design',
    title: 'Contemporary Living Room Design',
    caption: 'Modern living space with a cozy neutral palette',
    price: '₦890k Room Set'
  },
  {
    image: '/assets/carousell/bedroom-wardrobe-design.jpg',
    alt: 'Bedroom Wardrobe Design',
    title: 'Bedroom Wardrobe Design',
    caption: 'Clever wardrobe design for out-of-the-box bedrooms',
    price: '₦720k Wardrobe Set'
  },
  {
    image: '/assets/carousell/clever-wardrobe-design-out-of-the-box-bedrooms.jpg',
    alt: 'Clever Wardrobe Design For Out-Of-The-Box Bedrooms',
    title: 'Clever Wardrobe Design For Out-Of-The-Box Bedrooms',
    caption: 'Smart storage styling built around a modern bedroom layout',
    price: '₦760k Wardrobe Set'
  },
  {
    image: '/assets/carousell/cozy-wooden-desk-setup.jpg',
    alt: 'Cozy Wooden Desk Setup',
    title: 'Cozy Wooden Desk Setup',
    caption: 'A warm, compact desk arrangement for creative home work',
    price: '₦510k Workspace Set'
  },
  {
    image: '/assets/carousell/modern-living-space.jpg',
    alt: 'Modern living space',
    title: 'Modern living space',
    caption: 'Clean lines, layered textures, and an airy apartment feel',
    price: '₦850k Home Set'
  },
  {
    image: '/assets/carousell/scandinavian-style-home-office.jpg',
    alt: 'Scandinavian-style home office with a minimalist desk, ergonomic chair, and built-in shelves',
    title:
      'Scandinavian-style home office with a minimalist desk, ergonomic chair, and built-in shelves',
    caption: 'Minimalist workspace with built-in shelves and an ergonomic chair',
    price: '₦510k Workspace Set'
  },
  {
    image: '/assets/carousell/serene-living-room-sectional-sofa.jpg',
    alt: 'Serene living room with sectional sofa and abstract art coffee table floor lamp',
    title: 'Serene living room with sectional sofa and abstract art coffee table floor lamp',
    caption: 'A calm modern lounge centered on texture, art, and comfort',
    price: '₦930k Living Room Set'
  }
];

type Category = {
  image: string;
  alt: string;
  name: string;
  models: string;
  position: string;
};

const CATEGORIES: Category[] = [
  { image: '/assets/categories/bed-frame.jpg', alt: 'bed frame', name: 'Beds', models: '84 models', position: 'object-center' },
  { image: '/assets/categories/mattress.jpg', alt: 'mattress', name: 'Mattresses', models: '42 models', position: 'object-bottom' },
  { image: '/assets/categories/wardrobe.jpg', alt: 'wardrobe', name: 'Wardrobes', models: '56 models', position: 'object-center' },
  { image: '/assets/categories/desk.jpg', alt: 'desk', name: 'Desks', models: '63 models', position: 'object-center' },
  { image: '/assets/categories/nightstand.jpg', alt: 'nightstand', name: 'Nightstands', models: '38 models', position: 'object-top' },
  { image: '/assets/categories/rugs.jpg', alt: 'rugs', name: 'Rugs', models: '29 models', position: 'object-center' }
];

type BadgeTone = 'plain' | 'emerald' | 'amber';

type Featured = {
  image: string;
  alt: string;
  badge: string;
  tone: BadgeTone;
  meta: string;
  title: string;
  blurb: string;
  price: string;
  position: string;
};

const FEATURED: Featured[] = [
  {
    image: '/assets/featured-product/lunabedframe.jpg',
    alt: 'lunabedframe',
    badge: 'Handcrafted Oak',
    tone: 'plain',
    meta: 'Bedroom • Lagos',
    title: 'Luna Bed Frame',
    blurb: 'Natural solid oak with curved headboard',
    price: '₦450,000',
    position: 'object-center'
  },
  {
    image: '/assets/featured-product/cloud-bedding.jpg',
    alt: 'cloud bedding',
    badge: 'Verified Seller',
    tone: 'emerald',
    meta: 'Mattresses • Abuja',
    title: 'Comfort Cloud Mattress',
    blurb: 'Orthopedic dual-layer high density foam',
    price: '₦180,000',
    position: 'object-bottom'
  },
  {
    image: '/assets/featured-product/solid-wardrobe.jpg',
    alt: 'solid wardrobe',
    badge: '3-Door Minimal',
    tone: 'plain',
    meta: 'Storage • Ibadan',
    title: 'Aspen Solid Wardrobe',
    blurb: 'Ash wood finish with integrated hangers',
    price: '₦320,000',
    position: 'object-center'
  },
  {
    image: '/assets/featured-product/novo-workdesk.jpg',
    alt: 'novo workdesk',
    badge: 'Popular Compact',
    tone: 'amber',
    meta: 'Workspaces • Lagos',
    title: 'Novo Work Desk',
    blurb: 'Slender tapered legs with cable routing',
    price: '₦150,000',
    position: 'object-center'
  }
];

const BADGE_CLASS: Record<BadgeTone, string> = {
  plain:
    'absolute top-3 left-3 bg-white/90 backdrop-blur-[4px] text-[10px] font-bold text-stone-700 px-2 py-1 rounded-md uppercase tracking-wider',
  emerald:
    'absolute top-3 left-3 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border border-emerald-200',
  amber:
    'absolute top-3 left-3 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border border-amber-200'
};

type Scenario = {
  image: string;
  alt: string;
  position: string;
  title: string;
  copy: string;
  cta: string;
};

const SCENARIOS: Scenario[] = [
  {
    image: '/assets/space/bedroom.jpg',
    alt: 'bedroom',
    position: 'object-center',
    title: 'Furnish My Bedroom',
    copy: 'Beds, blackout lamps, rugs and organizers bundled for peaceful rest.',
    cta: 'Shop bedroom essentials'
  },
  {
    image: '/assets/space/workspace.jpg',
    alt: 'workspace',
    position: 'object-bottom',
    title: 'Build My Workspace',
    copy: 'Find clean desks, ergonomic chairs & storage made for focus and comfort.',
    cta: 'Find desks, chairs & more'
  },
  {
    image: '/assets/space/apartment.jpg',
    alt: 'apartment',
    position: 'object-top',
    title: 'First Apartment Starter',
    copy: 'Everything you need to set up home on a smart budget without sacrificing charm.',
    cta: 'Everything you need'
  }
];

const PILLS = [
  'Furnish my bedroom under ₦500k',
  'A comfortable mattress under ₦150k',
  'A desk for a small room',
  'Help me furnish my first apartment'
];

const SELL_BADGES = [
  'Verified Nigerian Buyers',
  'Pickup & Logistics Support',
  'Zero Upfront Listing Fee'
];

const SEARCH_PLACEHOLDER = "Tell us what you're looking for...";
const SEARCH_HINT = 'Please type a piece or budget...';
const AUTOPLAY_MS = 4000;

export function HomePage() {
  const [slide, setSlide] = useState(0);
  // Bumped by manual controls to restart the 4s autoplay (reference script.js).
  const [restartKey, setRestartKey] = useState(0);
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(SEARCH_PLACEHOLDER);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setSlide((current) => (current + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [restartKey]);

  const goTo = (index: number) => {
    setSlide(((index % SLIDES.length) + SLIDES.length) % SLIDES.length);
    setRestartKey((current) => current + 1);
  };

  const fillSearch = (text: string) => {
    setQuery(text.replace('e.g.', '').replace('✦', '').trim());
    searchRef.current?.focus();
  };

  const runSearch = () => {
    if (!query.trim()) {
      setPlaceholder(SEARCH_HINT);
      searchRef.current?.focus();
      return;
    }
    document
      .getElementById('categories-section')
      ?.scrollIntoView?.({ behavior: 'smooth' });
  };

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <div>
      {/* BEGIN: HeroSection */}
      <section
        className="relative overflow-hidden bg-[#F5F2EB] border-b border-[#E7E3DC]"
        data-purpose="hero-search-container"
        id="heroCarouselSection"
      >
        {/* Full-width Carousel Background Slides */}
        <div className="relative w-full h-[700px] sm:h-[760px] lg:h-[840px] overflow-hidden bg-stone-900">
          {SLIDES.map((item, index) => {
            const active = index === slide;
            return (
              <div
                key={item.image}
                className={`hero-slide absolute inset-0 transition-opacity duration-700 ${
                  active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
                data-slide-index={index}
              >
                <img
                  src={item.image}
                  alt={item.alt}
                  className="w-full h-full object-cover object-center transform scale-100 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#FBF9F5]/95 via-[#FBF9F5]/85 to-transparent sm:w-2/3 lg:w-3/5" />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute bottom-6 right-6 hidden md:flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-2xl shadow-lg z-20">
                  <div>
                    <p className="font-semibold text-xs text-white">{item.title}</p>
                    <p className="text-[11px] text-stone-300">{item.caption}</p>
                  </div>
                  <span className="bg-[#F38B00] text-white px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0">
                    {item.price}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Overlapping Foreground Search Content */}
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pointer-events-auto">
              <div
                className="max-w-xl lg:max-w-2xl bg-[#FBF9F5]/90 backdrop-blur-md border border-white/80 p-6 sm:p-10 rounded-3xl shadow-xl space-y-6"
                style={{
                  backgroundColor: 'rgba(245, 242, 237, 0.85)',
                  backdropFilter: 'blur(20px)',
                  borderColor: 'rgba(231, 227, 220, 0.9)'
                }}
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1F1E1D] leading-[1.18]">
                  Tell us what you need for your space.
                </h1>
                <p className="text-stone-600 text-base sm:text-lg leading-relaxed font-normal">
                  We&apos;ll help you find curated architectural pieces, sculptural ceramics, and
                  mindful spatial furniture designed for deliberate contemporary living.
                </p>

                {/* Interactive Smart Search Bar */}
                <form
                  className="bg-white rounded-2xl p-2 shadow-sm border border-[#E7E3DC] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  role="search"
                  onSubmit={onSearchSubmit}
                >
                  <div className="relative flex-1 flex items-center pl-3">
                    <svg
                      className="w-5 h-5 text-stone-400 shrink-0 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                    <input
                      className="w-full border-none focus:ring-0 text-sm sm:text-base text-stone-900 placeholder:text-stone-400 p-1.5 focus:outline-none bg-transparent"
                      id="mainHeroSearch"
                      placeholder={placeholder}
                      type="text"
                      value={query}
                      ref={searchRef}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <button
                    className="bg-[#543A23] hover:bg-[#3d2919] text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
                    id="searchExecuteBtn"
                    type="submit"
                  >
                    <span className="">Find matches</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  </button>
                </form>

                {/* Suggestion Quick-Pills */}
                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">
                    Popular queries
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-medium text-stone-700">
                    {PILLS.map((pill) => (
                      <button
                        key={pill}
                        className="suggestion-pill bg-white hover:bg-stone-50 border border-[#E7E3DC] hover:border-stone-400 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        type="button"
                        onClick={() => fillSearch(pill)}
                      >
                        <span className="text-stone-400">✦</span> {pill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Carousel Navigation Controls */}
                <div className="mt-1 flex items-center justify-center gap-4 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/60 shadow-md w-fit mx-auto">
                  <button
                    aria-label="Previous slide"
                    id="heroPrevBtn"
                    className="p-1 text-stone-700 hover:text-stone-950 transition-colors focus:outline-none"
                    type="button"
                    onClick={() => goTo(slide - 1)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M15 19l-7-7 7-7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  </button>
                  <div className="flex items-center gap-2" id="heroSlideDots">
                    {SLIDES.map((item, index) => {
                      const active = index === slide;
                      return (
                        <button
                          key={item.image}
                          aria-label={`Go to slide ${index + 1}`}
                          className={`hero-dot rounded-full transition-all ${
                            active
                              ? 'w-6 h-2 bg-[#543A23]'
                              : 'w-2 h-2 bg-stone-300 hover:bg-stone-400'
                          }`}
                          data-dot-index={index}
                          type="button"
                          onClick={() => goTo(index)}
                        />
                      );
                    })}
                  </div>
                  <button
                    aria-label="Next slide"
                    id="heroNextBtn"
                    className="p-1 text-stone-700 hover:text-stone-950 transition-colors focus:outline-none"
                    type="button"
                    onClick={() => goTo(slide + 1)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: HeroSection */}

      {/* BEGIN: CategoriesSection */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16"
        data-purpose="category-browser"
        id="categories-section"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Categories
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Explore essential furnishings tailored to every corner
            </p>
          </div>
          <Link
            className="text-xs sm:text-sm font-semibold text-[#543A23] hover:text-[#F38B00] transition-colors flex items-center gap-1 group"
            to={routes.shop}
          >
            Explore all{' '}
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
        {/* Categories Grid matching layout from snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {CATEGORIES.map((item) => (
            <Link
              key={item.name}
              className="group flex flex-col items-center bg-white border border-[#E7E3DC] rounded-2xl p-3 hover:shadow-md transition-all hover:-translate-y-0.5"
              to={routes.shop}
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-stone-100 mb-3">
                <img
                  alt={item.alt}
                  className={`w-full h-full ${item.position} group-hover:scale-110 transition-transform duration-500`}
                  src={item.image}
                />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-stone-800 group-hover:text-[#543A23]">
                {item.name}
              </span>
              <span className="text-[11px] text-stone-400 mt-0.5">{item.models}</span>
            </Link>
          ))}
        </div>
      </section>
      {/* END: CategoriesSection */}

      {/* BEGIN: FeaturedProductsSection */}
      <section className="bg-[#F5F2EB]/60 border-y border-[#E7E3DC] py-12 lg:py-16" data-purpose="featured-products">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                In Stock (Fast Delivery)
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Handpicked pieces verified for durability and aesthetics
              </p>
            </div>
            <Link
              className="text-xs sm:text-sm font-semibold text-[#543A23] hover:text-[#F38B00] transition-colors flex items-center gap-1 group"
              to={routes.shop}
            >
              View all <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
          {/* 4 Column Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURED.map((item) => (
              <article
                key={item.title}
                className="relative bg-white rounded-2xl border border-[#E7E3DC] overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all duration-300 group"
                data-purpose="product-card"
              >
                <Link className="block" to={routes.shop}>
                  <div className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden">
                    <img
                      alt={item.alt}
                      className={`w-full h-full ${item.position} group-hover:scale-105 transition-transform duration-500`}
                      src={item.image}
                    />
                    <span className={BADGE_CLASS[item.tone]}>{item.badge}</span>
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] text-[#543A23] font-semibold uppercase tracking-wider mb-1">
                      {item.meta}
                    </div>
                    <h3 className="font-bold text-stone-900 text-sm group-hover:text-[#F38B00] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-1">{item.blurb}</p>
                  </div>
                </Link>
                {/* Wishlist heart — decorative (static homepage content), kept
                    out of the card link so it stays a real button. */}
                <button
                  aria-label={`Add ${item.title} to wishlist`}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 text-stone-600 hover:text-red-500 transition-colors"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                </button>
                <div className="p-4 pt-0 flex items-center justify-between border-t border-stone-100 mt-2">
                  <div>
                    <span className="text-xs text-stone-400 block font-medium">Price</span>
                    <span className="text-base font-extrabold text-stone-900">{item.price}</span>
                  </div>
                  <button
                    aria-label={`Add ${item.title} to cart`}
                    className="p-2.5 rounded-xl bg-[#F5F2EB] text-stone-800 hover:bg-[#543A23] hover:text-white transition-colors"
                    title="Add to cart"
                    type="button"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path
                        d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      {/* END: FeaturedProductsSection */}

      {/* BEGIN: CuratedSpacesSection */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16"
        data-purpose="room-scenarios"
        id="curated-spaces"
      >
        {/* Container with soft warm frame */}
        <div className="bg-[#F5F2EB] border border-[#E7E3DC] rounded-3xl p-6 sm:p-8 lg:p-10">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              Create Your Perfect Space
            </h2>
            <p className="text-stone-600 text-sm sm:text-base mt-1">
              Furnish your bedroom, workspace or new home with ease and coordinated curation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SCENARIOS.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl overflow-hidden border border-[#E7E3DC] flex flex-col group hover:shadow-md transition-shadow"
              >
                <div className="aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    alt={item.alt}
                    className={`w-full h-full ${item.position} group-hover:scale-105 transition-transform duration-500`}
                    src={item.image}
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-base text-stone-900 mb-1">{item.title}</h3>
                    <p className="text-xs text-stone-500">{item.copy}</p>
                  </div>
                  <Link
                    className="inline-flex items-center text-xs font-bold text-[#543A23] group-hover:text-[#F38B00] mt-4 transition-colors"
                    to={routes.shop}
                  >
                    {item.cta}{' '}
                    <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* END: CuratedSpacesSection */}

      {/* BEGIN: MarketplaceSellSection */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-12"
        data-purpose="seller-value-proposition"
        id="sell-section"
      >
        <div className="relative rounded-3xl bg-[#2B2927] text-white overflow-hidden p-8 sm:p-12 shadow-lg">
          {/* Subtle background texture / shape */}
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-block px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-semibold tracking-wide">
                Marketplace Seller Network
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-100">
                Have furniture to sell or relocate?
              </h2>
              <p className="text-stone-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                List your quality pre-loved or artisan crafted furniture on SpaceFit. Connect
                directly with verified buyers, enjoy managed door-to-door delivery assistance, and
                receive secure escrow payouts.
              </p>
              {/* Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {SELL_BADGES.map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-2 text-stone-300 text-xs font-medium"
                  >
                    <span className="p-1 rounded-md bg-stone-800 text-amber-400">✓</span>
                    {badge}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <Link
                className="w-full text-center bg-[#F38B00] hover:bg-[#d97706] text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-colors shadow-md"
                to={routes.sellerApply}
              >
                Start Selling Today
              </Link>
              <Link
                className="w-full text-center bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold py-3 px-6 rounded-xl text-sm transition-colors"
                to={routes.sellerApply}
              >
                How selling works
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* END: MarketplaceSellSection */}
    </div>
  );
}
