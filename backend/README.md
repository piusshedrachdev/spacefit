# SpaceFit Backend API

REST API that powers the SpaceFit storefront in [`../frontend`](../frontend).
It exposes endpoints for the product catalogue, cart, checkout/orders, spatial
consultation bookings, newsletter signups and storefront configuration.

- **Stack:** Node.js 18+, Express 4, ESM modules
- **Storage:** in-memory seed data (swap for a real DB — see [To Be Provided Later](#to-be-provided-later))
- **Tests:** Vitest + Supertest

---

## Quick start

Run the following commands from the `backend` directory:

1. `npm install`
2. `copy .env.example .env` (macOS/Linux: `cp .env.example .env`)
3. `npm run dev` for watch mode, or `npm start`
4. `npm test` to run the suite

The dev server listens on http://localhost:4000.

Health probe: `GET /api/health`.

### Response envelope

Every response uses a consistent envelope:

- Success: `{ "success": true, "data": ..., "meta": ... }`
- Error: `{ "success": false, "error": { "message", "status", "details" } }`

Amounts are integers in the store base currency unit (NGN).

---

## Endpoint reference (all under /api)

### Health & config — `src/routes/meta.js`

| Method | Path | Frontend coverage | How it is used |
| --- | --- | --- | --- |
| GET | /api/health | ops / monitoring | uptime + readiness probe |
| GET | /api/meta/config | checkout.html, cart.html, footer | currency symbol, delivery fee, free-delivery threshold, VAT rate, serviceable cities, payment methods |
| GET | /api/meta/categories | index.html shop filter | category list with counts |

### Products — `src/routes/products.js`

| Method | Path | Frontend coverage | How it is used |
| --- | --- | --- | --- |
| GET | /api/products | index.html product grid | supports `category`, `search`, `featured`, `sort` (price_asc, price_desc, rating), `limit`, `offset` |
| GET | /api/products/featured | index.html homepage row | returns only `featured: true` products |
| GET | /api/products/categories | index.html filter chips | category names + counts |
| GET | /api/products/:id | product-details.html?id=... | full PDP: gallery, colours, sizes, specs, features, availability |
| GET | /api/products/:id/related | product-details.html "You may also like" | up to `limit` (default 4) related products |

### Cart — `src/routes/cart.js`

Frontend: `index.html` (`triggerAddToCart`), `cart.html` (`displayCart`, `changeQuantity`, `removeItem`, `saveCart`, `goToCheckout`), `checkout.html` order summary. Today the cart lives in `localStorage` under `spacefitCart`; these endpoints move it server-side.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/cart | create an empty cart, returns `id` |
| GET | /api/cart/:cartId | fetch cart with subtotal, delivery, VAT, total |
| POST | /api/cart/:cartId/items | add item `{ productId, quantity, size?, color? }` |
| PATCH | /api/cart/:cartId/items/:itemKey | set quantity (0 removes the line) |
| DELETE | /api/cart/:cartId/items/:itemKey | remove one line item |
| DELETE | /api/cart/:cartId | empty the cart |
| POST | /api/cart/:cartId/validate | pre-checkout validation |

Cart totals: `delivery = 0` when `subtotal >= FREE_DELIVERY_THRESHOLD`, otherwise `DELIVERY_FEE`. VAT = `subtotal * VAT_RATE`.

### Orders — `src/routes/orders.js`

Frontend: `checkout.html` (customer info, delivery info, payment method radio) and `order-succes.html` (order reference / lookup).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/orders | place an order; accepts nested `customer`/`delivery` objects or flat form fields (`fullName`, `email`, `phone`, `address`, `city`, `state`); also accepts `cartId` to build from a server cart |
| GET | /api/orders | admin listing, newest first |
| GET | /api/orders/:id | order detail for the success page |

`paymentMethod` must be one of `card`, `transfer`, `cash`. The response includes `reference` (e.g. `SF-...`), per-line items, subtotal, deliveryFee, vat and total.

### Consultations — `src/routes/consultations.js`

Frontend: `index.html` "Book Spatial Measurement (Free)" CTA and the "Ask SpaceFit" concierge widget (currently static buttons with no handler).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/consultations | book an in-home/spatial measurement: `{ fullName, email, phone, city, roomType?, preferredDate?, notes? }` |
| GET | /api/consultations | admin listing |

### Newsletter — `src/routes/newsletter.js`

Frontend: `index.html` footer "Journal & Spatial Digest" email capture (currently a hidden/static input).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/newsletter | subscribe `{ email }`; idempotent, reports `alreadySubscribed` |

---

## Status codes

| Code | Meaning |
| --- | --- |
| 200 | OK |
| 201 | Created (cart, cart item, order, consultation, newsletter) |
| 400 | Bad request (e.g. empty cart/order) |
| 404 | Resource not found |
| 422 | Validation failed — `error.details` maps field -> message |
| 500 | Internal server error |

---

## Project structure

- `src/app.js` — Express app factory (no port binding; importable by tests)
- `src/server.js` — HTTP bootstrap + graceful shutdown
- `src/config.js` — env-driven configuration
- `src/store.js` — in-memory data store + pricing logic
- `src/data/products.js` — seed catalogue (mirrors frontend product data)
- `src/middleware/errorHandler.js` — 404 + central error handling
- `src/routes/` — products, cart, orders, consultations, newsletter, meta
- `src/utils/` — http (ApiError/asyncHandler/ok), validate, slugify
- `tests/` — vitest + supertest suites
- `vitest.config.js` — test configuration

---

## Frontend integration map

| Frontend page | Feature | Backend endpoint(s) |
| --- | --- | --- |
| index.html | product grid / shop | GET /api/products, /api/products/categories |
| index.html | featured row | GET /api/products/featured |
| index.html | Add to cart button | POST /api/cart/:cartId/items |
| index.html | Book Spatial Measurement CTA | POST /api/consultations |
| index.html | footer newsletter | POST /api/newsletter |
| product-details.html | PDP data | GET /api/products/:id |
| product-details.html | related row | GET /api/products/:id/related |
| product-details.html | Add to cart | POST /api/cart/:cartId/items |
| cart.html | list / qty / remove / totals | GET/PATCH/DELETE /api/cart/:cartId(/items/:key) |
| checkout.html | city/state + fee display | GET /api/meta/config |
| checkout.html | place order | POST /api/orders |
| order-succes.html | confirmation | GET /api/orders/:id |

---

## To Be Provided Later

The endpoints are fully functional against in-memory data, but the following must be supplied before production:

1. **Database / persistence** — replace `src/store.js` (currently a Map) with a real database (PostgreSQL + Prisma, MongoDB, etc.). Carts and orders must survive restarts.
2. **Product catalogue source** — `src/data/products.js` is seed data hand-mirrored from the frontend. This should come from a PIM/CMS (e.g. Shopify, Sanity, Strapi) with real inventory, pricing and high-resolution images.
3. **Authentication & accounts** — no auth exists yet. Customer accounts, order history and admin-only routes (`GET /api/orders`, `GET /api/consultations`) need JWT/session auth and role checks.
4. **Payment integration** — `paymentMethod` is recorded but not charged. Integrate Paystack (NGN) and/or Stripe; add webhook endpoints to confirm payment status.
5. **Order lifecycle** — order status is always `pending`. Add transitions (`paid`, `processing`, `shipped`, `delivered`, `cancelled`) and admin update endpoints.
6. **Delivery pricing engine** — the flat fee / threshold is a placeholder. Needs per-city/state and per-item weight/dimension rules, plus real courier integration.
7. **Inventory & stock** — availability strings are static; add stock counts, reservations and low-stock enforcement.
8. **Email/notifications** — no emails are sent. Order confirmations, consultation replies and newsletter confirmations need a transactional email provider.
9. **Rate limiting & security** — add rate limiting on public POSTs (newsletter, consultations), request size limits, helmet, and input sanitisation.
10. **CORS lockdown** — `CORS_ORIGIN` defaults to `*`; set it to the real frontend origin(s) in production.
11. **Observability** — structured logging, metrics and error tracking (e.g. Sentry).
12. **Frontend wiring** — the frontend still reads/writes `localStorage`; it must be refactored to call these endpoints (cart id stored client-side, add-to-cart now hits the API).
13. **Wishlist / favourites** — `toggleFavorite` in product-details.html is local-only; needs a persistence endpoint if it should survive sessions.

---

## Configuration

Copy `.env.example` to `.env`. All values have sensible defaults:

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 4000 | HTTP port |
| NODE_ENV | development | environment |
| CORS_ORIGIN | * | allowed origins (comma separated) |
| CURRENCY | NGN | currency code |
| CURRENCY_SYMBOL | ₦ | display symbol |
| DELIVERY_FEE | 15000 | flat delivery fee |
| FREE_DELIVERY_THRESHOLD | 500000 | subtotal above which delivery is free |
| VAT_RATE | 0.075 | VAT as a decimal (0 disables) |
| SERVICEABLE_CITIES | Lagos,Abuja,Ibadan | checkout cities |

---

## Testing

Run `npm test` (or `npm run test:watch`). Suites live in `tests/`:

- `products.test.js` — listing, filtering, sorting, pagination, PDP, related, 404s
- `cart.test.js` — cart lifecycle, quantity, removal, totals, validation
- `orders.test.js` — order creation (nested + flat), cart-based orders, validation
- `meta.test.js` — health, config, newsletter, consultations, 404 envelope

`tests/setup.js` resets the in-memory store before each test for determinism.

---

## Troubleshooting

### `EADDRINUSE: address already in use :::4000`

Another process is already listening on port 4000 (often a previous `npm run dev`
that was not shut down cleanly). The server now detects this at bind time and
exits with an actionable message instead of crashing via `uncaughtException`.

To resolve it:

1. Find and stop the process holding the port:
   - Windows: `netstat -ano | findstr :4000` then `taskkill /PID <pid> /F`
   - macOS/Linux: `lsof -i :4000` then `kill <pid>`
2. Or run the server on a different port:
   - Windows: `set PORT=4001 && npm run dev`
   - macOS/Linux: `PORT=4001 npm run dev`

Tip: run `npm run dev` in only one terminal at a time. `node --watch` keeps a
child process alive, so closing the terminal window without Ctrl+C can leave an
orphaned listener behind.
