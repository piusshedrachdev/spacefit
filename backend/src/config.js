import 'dotenv/config';

/**
 * Centralised runtime configuration.
 * All values can be overridden through environment variables so the same
 * build can run locally, in staging and in production without code changes.
 */
export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Comma separated list of allowed origins for CORS. `*` allows all.
  corsOrigin: process.env.CORS_ORIGIN || '*',
  currency: process.env.CURRENCY || 'NGN',
  currencySymbol: process.env.CURRENCY_SYMBOL || '\u20a6',
  // Flat delivery fee in the smallest currency unit used by the storefront.
  deliveryFee: Number(process.env.DELIVERY_FEE) || 15000,
  // Free delivery threshold (subtotal above which delivery is free).
  freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD) || 500000,
  // 7.5% VAT (Nigeria). Set to 0 to disable.
  vatRate: Number(process.env.VAT_RATE ?? 0.075),
  // Comma separated list of serviceable cities/states for delivery.
  serviceableCities: (process.env.SERVICEABLE_CITIES || 'Lagos,Abuja,Ibadan').split(',').map((c) => c.trim())
};
