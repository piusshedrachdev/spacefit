/** Formatting helpers (ported from the legacy SpaceFitAPI surface). */

/** `formatPrice(450000)` → `₦450,000` */
export function formatPrice(amount?: number | string | null, symbol?: string): string {
  return (symbol || '\u20a6') + Number(amount || 0).toLocaleString('en-NG');
}
