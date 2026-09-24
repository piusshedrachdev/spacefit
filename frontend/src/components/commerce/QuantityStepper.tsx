interface QuantityStepperProps {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  /**
   * `cart` = round outline buttons (cart lines);
   * `pdp`  = bordered box (product details purchase row).
   */
  variant?: 'cart' | 'pdp';
}

/** Shared ± quantity control (legacy cart.js / product-details.js markup). */
export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  variant = 'cart'
}: QuantityStepperProps) {
  if (variant === 'pdp') {
    return (
      <div className="flex items-center border border-outline-variant/40 rounded-lg bg-surface-container-low p-1">
        <button
          type="button"
          onClick={onDecrease}
          aria-label="Decrease quantity"
          className="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-base">remove</span>
        </button>
        <span className="w-8 text-center font-label-md text-label-md font-bold text-on-surface">
          {quantity}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          aria-label="Increase quantity"
          className="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-base">add</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        aria-label="Decrease quantity"
        className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center hover:border-primary"
      >
        <span className="material-symbols-outlined text-base">remove</span>
      </button>
      <span className="w-8 text-center font-label-md">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label="Increase quantity"
        className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center hover:border-primary"
      >
        <span className="material-symbols-outlined text-base">add</span>
      </button>
    </div>
  );
}
