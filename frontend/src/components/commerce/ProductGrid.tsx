import type { ReactNode } from 'react';
import { ProductCard } from '@/components/commerce/ProductCard';
import type { Product } from '@/types/api';

const SKELETONS = [0, 1, 2, 3];

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  /**
   * Rendered in place of the cards when the list is empty (and not loading).
   * Pass `null` explicitly to render nothing (e.g. the PDP related row).
   * Omitted → legacy "No products found." message.
   */
  empty?: ReactNode;
  /** Grid classes; the home catalogue and the PDP related row differ. */
  className?: string;
  cardVariant?: 'grid' | 'related';
}

/** Shared product grid: skeleton while loading, cards, or an empty slot. */
export function ProductGrid({
  products,
  loading = false,
  empty,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter',
  cardVariant = 'grid'
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={className}>
        {SKELETONS.map((index) => (
          <div
            key={index}
            className="bg-surface-container-lowest rounded-xl p-space-sm space-y-space-sm animate-pulse"
          >
            <div className="w-full aspect-[4/3] bg-surface-container-high rounded-lg" />
            <div className="h-4 bg-surface-container-high rounded w-2/3" />
            <div className="h-3 bg-surface-container-high rounded w-1/2" />
            <div className="flex justify-between items-center pt-space-xs">
              <div className="h-5 bg-surface-container-high rounded w-1/3" />
              <div className="h-8 bg-surface-container-high rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <>
        {empty === undefined ? (
          <p className="col-span-full text-center text-on-surface-variant py-12">
            No products found.
          </p>
        ) : (
          empty
        )}
      </>
    );
  }

  return (
    <div className={className}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} variant={cardVariant} />
      ))}
    </div>
  );
}
