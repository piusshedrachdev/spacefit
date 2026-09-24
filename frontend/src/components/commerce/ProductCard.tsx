import { Link } from 'react-router-dom';
import { useSettings } from '@/context/SettingsProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { ProductImage } from '@/components/commerce/ProductImage';
import { useAddToCart } from '@/hooks';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { Product } from '@/types/api';

interface ProductCardProps {
  product: Product;
  /**
   * `grid` = home catalogue card (legacy cardHtml in js/index.js);
   * `related` = compact "You may also like" card (legacy js in
   * product-details.html — the markup differs slightly there).
   */
  variant?: 'grid' | 'related';
}

/**
 * The one product card. Shared by the home catalogue and the PDP related
 * row; wishlist toggle is backed by /api/wishlist via WishlistProvider.
 */
export function ProductCard({ product, variant = 'grid' }: ProductCardProps) {
  const { has, toggle } = useWishlist();
  const favorite = has(product.id);
  const { addToCart } = useAddToCart();
  const { config } = useSettings();
  const symbol = config?.currencySymbol;

  const image = product.images?.[0] ?? '';
  const inStock = /stock/i.test(product.availability ?? '') && !/low/i.test(product.availability ?? '');

  const favoriteButton = (
    <button
      type="button"
      aria-label={favorite ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={() => void toggle(product.id)}
      className={
        variant === 'related'
          ? 'absolute top-2 right-2 w-7 h-7 rounded-full bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-on-surface flex items-center justify-center transition-transform active:scale-90 shadow-xs'
          : 'absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-on-surface flex items-center justify-center transition-transform active:scale-90 shadow-sm'
      }
    >
      <span
        className={`material-symbols-outlined ${variant === 'related' ? 'text-sm' : 'text-base'} ${favorite ? 'text-primary' : ''}`}
        style={{ fontVariationSettings: favorite ? "'FILL' 1" : "'FILL' 0" }}
      >
        favorite
      </span>
    </button>
  );

  if (variant === 'related') {
    return (
      <article className="product-card group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all border border-outline-variant/20">
        <div className="relative w-full aspect-[4/3] bg-surface-container-low overflow-hidden">
          <Link to={routes.product(product.id)} aria-label={product.title}>
            <ProductImage
              src={image}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              fallbackClassName="w-full h-full flex items-center justify-center text-3xl"
            />
          </Link>
          {favoriteButton}
        </div>
        <div className="p-space-xs sm:p-space-sm flex flex-col flex-1 justify-between gap-space-xs">
          <Link
            to={routes.product(product.id)}
            className="font-headline-sm text-xs sm:text-[13px] leading-tight font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1"
          >
            {product.title}
          </Link>
          <div className="flex items-center justify-between pt-1">
            <span className="font-price-md text-xs sm:text-sm font-bold text-on-surface">
              {formatPrice(product.price, symbol)}
            </span>
            <button
              type="button"
              title="Add to cart"
              aria-label={`Add ${product.title} to cart`}
              onClick={() => void addToCart(product.id, { label: product.title })}
              className="bg-primary hover:bg-primary-container text-on-primary p-1.5 rounded-lg shadow-xs transition-transform active:scale-95 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xs sm:text-sm">add</span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="product-card group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
      <div className="relative w-full aspect-[4/3] bg-surface-container-low overflow-hidden">
        <ProductImage
          src={image}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallbackClassName="w-full h-full flex items-center justify-center text-5xl"
        />
        {product.featured ? (
          <div className="absolute top-3 left-3">
            <span className="bg-primary text-on-primary font-label-sm text-[10px] tracking-wider uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
              Featured
            </span>
          </div>
        ) : null}
        {favoriteButton}
      </div>
      <div className="p-space-md flex flex-col flex-1 justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm">
            <span>{product.category}</span>
            <div className="flex items-center text-secondary-container">
              <span
                className="material-symbols-outlined text-xs"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <span className="font-bold text-on-surface ml-0.5 text-[11px]">{product.rating}</span>
              <span className="text-outline text-[10px] ml-0.5">({product.reviews})</span>
            </div>
          </div>
          <Link
            to={routes.product(product.id)}
            className="block font-headline-sm text-[15px] leading-tight text-on-surface group-hover:text-primary transition-colors line-clamp-1"
          >
            {product.title}
          </Link>
          <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">
            {product.shortDescription || ''}
          </p>
        </div>
        <div className="pt-space-xs flex items-center justify-between">
          <div className="flex flex-col">
            <span
              className={`text-[10px] ${inStock ? 'text-emerald-700' : 'text-amber-700'} font-label-sm uppercase font-semibold flex items-center gap-1`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-600' : 'bg-amber-600'}`}
              />{' '}
              {product.availability}
            </span>
            <span className="font-price-md text-price-md text-on-surface font-bold">
              {formatPrice(product.price, symbol)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void addToCart(product.id, { label: product.title })}
            className="bg-primary hover:bg-primary-container text-on-primary px-space-md py-space-xs rounded-lg font-label-md text-label-md shadow-sm transition-transform active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>
  );
}
