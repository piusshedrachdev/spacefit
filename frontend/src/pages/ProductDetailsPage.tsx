import { useLayoutEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProduct, getRelatedProducts } from '@/api/products';
import { ProductGrid, ProductImage, QuantityStepper } from '@/components/commerce';
import { useSettings } from '@/context/SettingsProvider';
import { useWishlist } from '@/context/WishlistProvider';
import { useAddToCart, useAsync } from '@/hooks';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Button, Spinner } from '@/ui';
import type { Product } from '@/types/api';

/**
 * Product details — port of legacy product-details.html + js: gallery with
 * thumbnails, info/purchase column, specs table and the related row.
 */
export function ProductDetailsPage() {
  const { id } = useParams();
  const productId = id || 'luna-bed'; // legacy default when ?id= is missing

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        getProduct(productId),
        getRelatedProducts(productId, 4).catch(() => [] as Product[])
      ]),
    [productId]
  );
  const product = data?.[0] ?? null;
  const related = data?.[1] ?? [];

  const { config } = useSettings();
  const symbol = config?.currencySymbol;
  const { addToCart, pending } = useAddToCart();

  const [imageIndex, setImageIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { has, toggle } = useWishlist();
  const favorite = has(product?.id ?? '');

  useLayoutEffect(() => {
    setImageIndex(0);
    setColorIndex(0);
    setQuantity(1);
    setSize(product?.sizes?.[0] ?? '');
    if (product) document.title = `${product.title} - SpaceFit`;
  }, [product?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-space-2xl">
        <Spinner />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-lg mx-auto mt-space-2xl p-space-xl bg-surface-container-lowest rounded-xl border border-outline-variant/50 text-center space-y-space-sm">
        <span className="material-symbols-outlined text-5xl text-outline">error</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">
          Couldn&apos;t load this product
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {error?.message ?? 'Product not found.'}
        </p>
        <Button onClick={() => void reload()}>Try again</Button>
      </div>
    );
  }

  const gallery = product.images.length ? product.images : [''];
  const lowStock = (product.availability ?? '').toLowerCase().includes('low');
  const availabilityClass = lowStock
    ? 'text-xs text-amber-700 font-label-md uppercase font-semibold flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60'
    : 'text-xs text-emerald-700 font-label-md uppercase font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60';

  return (
    <div className="w-full max-w-[1360px] mx-auto px-margin py-space-lg">
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-space-md md:p-space-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter-lg items-start">
          {/* Gallery */}
          <div className="md:col-span-6 space-y-space-md">
            <div className="relative w-full aspect-[4/3] bg-surface-container-low rounded-xl overflow-hidden shadow-xs border border-outline-variant/20">
              <ProductImage
                src={gallery[imageIndex]}
                alt={product.title}
                className="w-full h-full object-cover transition-opacity duration-300"
                fallbackClassName="w-full h-full flex items-center justify-center text-6xl"
              />
              <button
                type="button"
                aria-label={favorite ? 'Remove from wishlist' : 'Add to wishlist'}
                onClick={() => void toggle(product.id)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-on-surface flex items-center justify-center transition-transform active:scale-90 shadow-sm"
              >
                <span
                  className={`material-symbols-outlined text-lg ${favorite ? 'text-primary' : ''}`}
                  style={{ fontVariationSettings: favorite ? "'FILL' 1" : "'FILL' 0" }}
                >
                  favorite
                </span>
              </button>
            </div>
            {gallery.length > 1 ? (
              <div className="flex items-center gap-space-sm overflow-x-auto pb-1">
                {gallery.map((imgUrl, index) => (
                  <button
                    key={`${imgUrl}-${index}`}
                    type="button"
                    aria-label={`View image ${index + 1}`}
                    onClick={() => setImageIndex(index)}
                    className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      index === imageIndex
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-outline-variant/30 hover:border-outline'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Info & purchase controls */}
          <div className="md:col-span-6 space-y-space-md flex flex-col justify-between h-full">
            <div className="space-y-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-outline font-semibold uppercase tracking-wider">
                  {product.category}
                </span>
                <div className="flex items-center text-secondary-container">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="font-bold text-on-surface ml-1 text-xs">{product.rating}</span>
                  <span className="text-outline text-xs ml-1">({product.reviews} reviews)</span>
                </div>
              </div>

              <h1 className="font-headline-lg text-headline-lg md:text-[34px] md:leading-[42px] text-on-surface font-semibold tracking-tight">
                {product.title}
              </h1>

              <div className="flex items-center gap-space-md pt-space-xs">
                <div className="flex items-baseline gap-2">
                  <span className="font-price-lg text-price-lg text-on-surface font-bold">
                    {formatPrice(product.price, symbol)}
                  </span>
                  {product.origPrice ? (
                    <span className="text-xs text-outline line-through">
                      {formatPrice(product.origPrice, symbol)}
                    </span>
                  ) : null}
                </div>
                <span className={availabilityClass}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${lowStock ? 'bg-amber-600' : 'bg-emerald-600'}`}
                  />{' '}
                  {product.availability}
                </span>
              </div>

              <p className="font-body-md text-body-md text-on-surface-variant pt-space-xs leading-relaxed">
                {product.description}
              </p>

              {product.features.length ? (
                <div className="pt-space-xs space-y-1.5">
                  <h3 className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider">
                    Key Features
                  </h3>
                  <ul className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
                    {product.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {product.colors.length ? (
              <div className="pt-space-xs space-y-space-xs">
                <label className="font-label-md text-label-md font-bold text-on-surface block uppercase tracking-wider">
                  Colour:{' '}
                  <span className="font-normal text-on-surface-variant">
                    {product.colors[colorIndex]?.name ?? ''}
                  </span>
                </label>
                <div className="flex items-center gap-space-sm">
                  {product.colors.map((color, index) => (
                    <button
                      key={color.name}
                      type="button"
                      title={color.name}
                      aria-label={color.name}
                      onClick={() => setColorIndex(index)}
                      style={{ backgroundColor: color.hex }}
                      className={`w-7 h-7 rounded-full transition-all border border-black/10 flex items-center justify-center ${
                        index === colorIndex ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {product.sizes.length ? (
              <div className="pt-space-xs space-y-space-xs">
                <label
                  className="font-label-md text-label-md font-bold text-on-surface block uppercase tracking-wider"
                  htmlFor="sizeSelect"
                >
                  Size
                </label>
                <div className="relative w-full">
                  <select
                    id="sizeSelect"
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg py-2.5 px-space-md font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    {product.sizes.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>
            ) : null}

            <div className="pt-space-sm flex items-center gap-space-md">
              <QuantityStepper
                variant="pdp"
                quantity={quantity}
                onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
                onIncrease={() => setQuantity((current) => current + 1)}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void addToCart(product.id, {
                    quantity,
                    size: size || undefined,
                    color: product.colors[colorIndex]?.name,
                    label: `${product.title} (x${quantity})`
                  })
                }
                className="flex-1 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-space-lg rounded-lg shadow-sm font-semibold flex items-center justify-center gap-space-xs transition-all active:scale-95 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg">local_mall</span>
                <span>{pending ? 'Adding…' : 'Add to Cart'}</span>
              </button>
            </div>

            <div className="pt-space-xs">
              <Link
                to={routes.home}
                className="w-full border border-outline/60 text-on-surface hover:bg-surface-container-low py-2.5 px-space-lg rounded-lg font-label-md text-label-md font-semibold text-center block transition-all"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* Specifications */}
        {product.specs.length ? (
          <div className="mt-space-2xl pt-space-lg border-t border-outline-variant/20">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-md">
              Specifications
            </h2>
            <div className="bg-surface-container-low/60 rounded-xl p-space-md border border-outline-variant/30 max-w-3xl">
              <dl className="divide-y divide-outline-variant/20 text-body-sm font-body-sm">
                {product.specs.map((spec, index) => (
                  <div
                    key={spec.label}
                    className={`py-2.5 flex items-center justify-between ${
                      index === 0 ? '' : 'border-t border-outline-variant/20'
                    }`}
                  >
                    <dt className="font-label-md text-label-md font-bold text-on-surface-variant w-1/3">
                      {spec.label}
                    </dt>
                    <dd className="font-body-md text-body-md text-on-surface w-2/3">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}

        {/* Related */}
        <div className="mt-space-2xl pt-space-lg border-t border-outline-variant/20">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md">
            You may also like
          </h2>
          <ProductGrid
            products={related}
            cardVariant="related"
            empty={null}
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-gutter"
          />
        </div>
      </section>
    </div>
  );
}
