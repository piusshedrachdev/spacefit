interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Icon glyph shown when the product has no image. */
  fallbackIcon?: string;
  /** Classes for the fallback (position/sizing inside the caller's box). */
  fallbackClassName?: string;
}

/**
 * Shared product image with the legacy chair-icon fallback — used by the
 * product cards, cart lines, checkout summary and order confirmation so an
 * empty `images[]` never renders a broken <img>.
 */
export function ProductImage({
  src,
  alt,
  className = '',
  fallbackIcon = 'chair',
  fallbackClassName = ''
}: ProductImageProps) {
  if (!src) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`material-symbols-outlined text-outline ${fallbackClassName}`}
      >
        {fallbackIcon}
      </span>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
