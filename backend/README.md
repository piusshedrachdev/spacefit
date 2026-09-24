# SpaceFit Backend API

REST API that powers the SpaceFit storefront in [`../frontend`](../frontend).
It exposes endpoints for the product catalogue, cart, checkout/orders, spatial
consultation bookings, newsletter signups, storefront configuration, auth,
seller onboarding (applications → approval → seller dashboard), notifications,
product reviews and return requests.

- **Stack:** Node.js 18+, Express 4, ESM modules
- **Storage:** Supabase (PostgreSQL) via the `src/db` facade, with an
  in-memory fallback so tests and local dev need no credentials
  (see [Supabase setup](supabase/README.md))
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

To run the API and the storefront together, use the quick start in the
[root README](../README.md) (`npm run dev` starts both).

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
| GET | /api/meta/config | `/checkout`, `/cart`, footer | currency symbol, delivery fee, free-delivery threshold, VAT rate, serviceable cities, payment methods |
| GET | /api/meta/categories | `/` shop filter | category list with counts |

### Products — `src/routes/products.js`

| Method | Path | Frontend coverage | How it is used |
| --- | --- | --- | --- |
| GET | /api/products | `/` product grid | supports `category`, `search`, `featured`, `sort` (price_asc, price_desc, rating), `limit`, `offset` |
| GET | /api/products/featured | `/` homepage row | returns only `featured: true` products |
| GET | /api/products/categories | `/` filter chips | category names + counts |
| GET | /api/products/:id | `/products/:id` | full PDP: gallery, colours, sizes, specs, features, availability |
| GET | /api/products/:id/related | `/products/:id` "You may also like" | up to `limit` (default 4) related products |

### Cart — `src/routes/cart.js`

Frontend: `/` (add-to-cart buttons), `/cart` (list, quantity, remove, totals), `/checkout` (order summary). Cart contents are server-side; the cart id is kept in `localStorage` under `spacefitCartId`.

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

Frontend: `/checkout` (customer info, delivery info, payment method) and `/order-success/:id` (confirmation; the legacy `order-succes.html` typo URL still redirects there).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/orders | place an order; accepts nested `customer`/`delivery` objects or flat form fields (`fullName`, `email`, `phone`, `address`, `city`, `state`); also accepts `cartId` to build from a server cart |
| GET | /api/orders | admin listing, newest first |
| GET | /api/orders/:id | order detail for the success page |

`paymentMethod` must be one of `card`, `transfer`, `cash`. The response includes `reference` (e.g. `SF-...`), per-line items, subtotal, deliveryFee, vat and total.

### Consultations — `src/routes/consultations.js`

Frontend: `/` "Book Spatial Measurement (Free)" CTA (wired through `frontend/src/api/forms.ts`). The old "Ask SpaceFit" concierge buttons were not part of the React port.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/consultations | book an in-home/spatial measurement: `{ fullName, email, phone, city, roomType?, preferredDate?, notes? }` |
| GET | /api/consultations | admin listing |

### Newsletter — `src/routes/newsletter.js`

Frontend: no visible form yet — the legacy footer capture was hidden/static; `frontend/src/api/forms.ts` exposes `subscribe()` for when a form ships.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/newsletter | subscribe `{ email }`; idempotent, reports `alreadySubscribed` |

### Authentication — `src/routes/auth.js`

Frontend: `/auth` (sign in / create account) — session layer in
`frontend/src/lib/session.ts` (persists `spacefitSession` in `localStorage`);
the typed fetch client (`frontend/src/lib/api.ts`) auto-refreshes once on `401`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/auth/signup | create an account `{ email, password, fullName, phone? }` |
| POST | /api/auth/login | sign in `{ email, password }` → session tokens + profile |
| POST | /api/auth/logout | revoke/forget the current session |
| POST | /api/auth/refresh | exchange a refresh token for a new access token |
| POST | /api/auth/forgot-password | request a reset link |
| POST | /api/auth/reset-password | set a new password with the reset token |
| GET | /api/auth/me | current user + profile (drives the header account menu) |
| PATCH | /api/auth/me | update profile fields (`full_name`, `phone`, …) |

### Seller applications & sellers — `src/routes/sellers.js`

Frontend: `/seller-apply` (application form + status), `/admin/:tab` (application review, seller management), `/seller-dashboard/:tab` (gating + shop profile).

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| POST | /api/sellers/applications | auth | submit an application (validates fields + both accepted flags); notifies admins and emails the applicant |
| GET | /api/sellers/applications?status= | admin | review queue, newest first |
| GET | /api/sellers/applications/:id | admin | application detail |
| PATCH | /api/sellers/applications/:id | admin | `{ decision: 'approved'\|"rejected", reviewNotes }` — approve creates the seller row + promotes `profiles.role`, then notifies + emails |
| GET | /api/sellers | admin | seller list annotated with product counts |
| PATCH | /api/sellers/:id | admin | `{ status: 'active'\|"blocked", reason? }` — notification + email |
| GET | /api/sellers/me | auth | caller seller context + latest application (drives dashboard gating) |
| PATCH | /api/sellers/me | seller | update `shopName` / `deliveryPlaces` / `bio` |
| GET | /api/sellers/me/dashboard | seller | stats (products, units sold, revenue, avg rating, reviews, returns) + reviews + returns + notifications |

### Notifications — `src/routes/notifications.js`

Frontend: header notifications bell on every page.

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | /api/notifications | auth | own notifications newest first + `unreadCount` |
| PATCH | /api/notifications/:id/read | auth | mark one read (scoped to the caller) |
| POST | /api/notifications/read-all | auth | mark every notification read |

### Returns — `src/routes/returns.js`

Frontend: `/seller-dashboard` returns tab, `/admin` returns view.

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | /api/returns | seller/admin | seller's own returns, or all for an admin |
| POST | /api/returns | auth | raise a return request `{ orderId, productId, reason }` |
| PATCH | /api/returns/:id | seller/admin | `{ status, resolutionNotes? }` — owner-or-admin |

### Wishlist — `src/routes/wishlist.js`

Frontend: heart toggle on product cards and `/products/:id`, header wishlist icon, `/wishlist` page.

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | /api/wishlist | auth | the caller's saved products, newest first |
| POST | /api/wishlist/:productId | auth | save a product (idempotent) → the saved product |
| DELETE | /api/wishlist/:productId | auth | remove a saved product → `{ productId, removed }` |

### Product reviews & write endpoints — `src/routes/products.js`

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| POST | /api/products | seller/admin | create a listing (full product schema); `sellerId` set from the caller |
| PATCH | /api/products/:id | owner/admin | edit a listing (only admins may toggle `featured`) |
| DELETE | /api/products/:id | owner/admin | remove a listing |
| GET | /api/products/:id/reviews | public | published reviews for a product |
| POST | /api/products/:id/reviews | auth | leave a review `{ rating (1-5), comment? }` |

### Store settings — `src/routes/meta.js`

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | /api/meta/settings | public | `{ policies, discounts }` for the footer + `/policies` + discount banner |
| PUT | /api/meta/settings | admin | persist `{ policies?, discounts? }` edits from the admin dashboard |

---

## Authentication & dev mode

The API integrates with Supabase Auth (`/api/auth/*`). When `USE_SUPABASE=true` and
credentials are present, `requireAuth` / `requireAdmin` / `requireSeller` validate the
caller's bearer token.

In the default **in-memory mode** (no Supabase) the guards are relaxed so the whole
seller flow can be exercised locally and in tests. Identify yourself with an
`X-Dev-User` header using one of the seeded account ids:

| Id | Email | Role |
| --- | --- | --- |
| `dev-user-admin` | admin@spacefit.ng | admin |
| `dev-user-seller` | seller@spacefit.ng | seller (active) |
| `dev-user-customer` | customer@spacefit.ng | customer |
| `seed-user-amara` | amara@example.com | applicant (pending, no login) |

All seeded accounts use the password `spacefit123`. The `X-Dev-User` header is ignored
whenever Supabase is configured.

### Roles

`public.profiles.role` is the single source of truth for authorization. The guards
(`requireAdmin`, `requireSeller`) and route-level ownership checks read the profile row
via `resolveRole(req)`, so promoting a user is a one-line SQL update:

    update public.profiles set role = 'admin' where id = '<user-uuid>';

Valid roles are `customer`, `seller` and `admin`. Approving a seller application flips
`profiles.role` to `seller` automatically. JWT metadata (app_metadata/user_metadata) is
only a fallback when no profile row exists and is never required.

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
- `src/routes/` — products, cart, orders, consultations, newsletter, meta, sellers, notifications, returns
- `src/db/` — Supabase repositories + the `db/index.js` backend facade
- `src/services/` — auth (Supabase) and email (Brevo) services
- `src/middleware/` — auth guards (attachUser/requireAuth/requireAdmin/requireSeller) + error handler
- `src/utils/` — http (ApiError/asyncHandler/ok), validate, slugify
- `tests/` — vitest + supertest suites
- `vitest.config.js` — test configuration
- `supabase/migrations/` — numbered SQL migrations (schema, RLS, storage, seed)

---

## Frontend integration map

Routes are React paths (the Vite SPA); the legacy `.html` URLs still resolve
and redirect client-side.

| Route | Feature | Backend endpoint(s) |
| --- | --- | --- |
| `/` | product grid / shop | GET /api/products, /api/products/categories |
| `/` | featured row | GET /api/products/featured |
| `/` | Add to cart button | POST /api/cart/:cartId/items |
| `/` | Book Spatial Measurement CTA | POST /api/consultations |
| `/` | footer newsletter | POST /api/newsletter |
| `/products/:id` | PDP data | GET /api/products/:id |
| `/products/:id` | related row | GET /api/products/:id/related |
| `/products/:id` | Add to cart | POST /api/cart/:cartId/items |
| `/cart` | list / qty / remove / totals | GET/PATCH/DELETE /api/cart/:cartId(/items/:key) |
| `/checkout` | city/state + fee display | GET /api/meta/config |
| `/checkout` | place order | POST /api/orders |
| `/order-success/:id` | confirmation | GET /api/orders/:id |
| `/auth` | sign in / create account | POST /api/auth/login, /api/auth/signup |
| `/seller-apply` | application form + status | POST /api/sellers/applications, GET /api/sellers/me |
| `/seller-dashboard/:tab` | gating + KPIs | GET /api/sellers/me, /api/sellers/me/dashboard |
| `/seller-dashboard/:tab` | product CRUD | POST/PATCH/DELETE /api/products |
| `/seller-dashboard/:tab` | reviews / returns / notifications | GET /api/products/:id/reviews, /api/returns, /api/notifications |
| `/admin/:tab` | application review queue | GET/PATCH /api/sellers/applications(/:id) |
| `/admin/:tab` | block / unblock sellers | PATCH /api/sellers/:id |
| `/admin/:tab` | orders (read-only) | GET /api/orders |
| `/admin/:tab` | policies + discounts | GET/PUT /api/meta/settings |
| shared chrome (`layout/Chrome.tsx`, `layout/Header.tsx`) | account menu, notifications bell, footer policy links, discount banner | GET /api/auth/me, /api/notifications, /api/meta/settings |
| `/policies` | rendered store policies + active discounts | GET /api/meta/settings, GET /api/meta/config |
| `/wishlist`, PDP/card hearts, header icon | save / list / remove wishlist items | GET/POST/DELETE /api/wishlist(/:productId) |

---

## To Be Provided Later

The API is fully functional against the in-memory store and Supabase. The following must be supplied before production:

1. **Product catalogue source** — `src/data/products.js` is seed data hand-mirrored from the frontend. This should come from a PIM/CMS (e.g. Shopify, Sanity, Strapi) with real inventory, pricing and high-resolution images (seller-created products already persist via Supabase).
2. **Payment integration** — `paymentMethod` is recorded but not charged. Integrate Paystack (NGN) and/or Stripe; add webhook endpoints to confirm payment status.
3. **Order lifecycle** — order status is always `pending`. Add transitions (`paid`, `processing`, `shipped`, `delivered`, `cancelled`) and admin update endpoints.
4. **Delivery pricing engine** — the flat fee / threshold is a placeholder. Needs per-city/state and per-item weight/dimension rules, plus real courier integration.
5. **Inventory & stock** — availability strings are static; add stock counts, reservations and low-stock enforcement.
6. **Email coverage** — Brevo transactional email is implemented for the seller-ecosystem events (application received/approved/rejected, block/unblock). Order confirmations, consultation replies and newsletter confirmations still need templates (`src/services/email.js` is the single place to add them).
7. **Rate limiting & security** — add rate limiting on public POSTs (newsletter, consultations), request size limits, helmet, and input sanitisation.
8. **CORS lockdown** — `CORS_ORIGIN` defaults to `*`; set it to the real frontend origin(s) in production.
9. **Observability** — structured logging, metrics and error tracking (e.g. Sentry).
10. **Email delivery in production** — set `BREVO_API_KEY`; without it emails are logged, not sent (graceful no-op for dev/tests).

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
| USE_SUPABASE | false | use Supabase instead of the in-memory store |
| SUPABASE_URL | — | Supabase project URL |
| SUPABASE_SECRET_KEY | — | service-role key (server only) |
| SUPABASE_PUBLISHABLE_KEY | — | anon/publishable key |
| BREVO_API_KEY | — | Brevo transactional email key (blank = log-only) |
| BREVO_SENDER_EMAIL | no-reply@spacefit.ng | verified sender address |
| BREVO_SENDER_NAME | SpaceFit | sender display name |
| APP_URL | http://localhost:4000 | base URL used in email deep links |

---

## Testing

Run `npm test` (or `npm run test:watch`). Suites live in `tests/`:

- `products.test.js` — listing, filtering, sorting, pagination, PDP, related, 404s
- `cart.test.js` — cart lifecycle, quantity, removal, totals, validation
- `orders.test.js` — order creation (nested + flat), cart-based orders, validation
- `meta.test.js` — health, config, newsletter, consultations, 404 envelope
- `meta-settings.test.js` — public settings GET + admin PUT round-trip
- `sellers.test.js` — application submit/review/approve/reject, block/unblock, `/me` + dashboard
- `products-write.test.js` — seller CRUD on own listings, cross-seller denial, admin override
- `notifications.test.js` — per-user isolation, mark-one-read, read-all
- `email.test.js` — template builders + no-key log-only fallback
- `auth.test.js` — auth request validation
- `db.test.js` — db facade + Supabase migration sanity checks

`server.test.js` covers port binding / `EADDRINUSE` handling and `static.test.js`
covers static frontend serving (the `dist` entry + a hashed asset, the SPA shell
at every legacy `.html` URL and clean path, and the JSON 404 envelope for
unknown `/api/*` routes and missing assets).

`tests/setup.js` resets the in-memory store before each test for determinism.

### End-to-end smoke pass

`scripts/e2e-seller-flow.sh` walks the whole seller ecosystem over HTTP
(apply → approve → list product → review → order → return → block/unblock,
plus settings, notifications, `auth/me` and every linked page). It targets a
memory-mode server:

    # terminal 1
    cd backend && USE_SUPABASE=false PORT=4010 npm start
    # terminal 2
    bash scripts/e2e-seller-flow.sh

46 checks; exits non-zero on the first failure set.

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

---

## Serving the frontend

The backend serves the built storefront from `../frontend/dist` so the UI and API share an origin (no CORS setup needed). Build it first (`npm run build` in `../frontend`), then run the API and open http://localhost:4000/ . Clean URLs work: `/cart`, `/checkout`, `/products/luna-bed`, and every legacy `.html` URL (`/product-details.html?id=luna-bed`, `/policies.html#returns`, …) receives the SPA shell — `frontend/src/appRoutes.tsx` redirects or renders on the client. Override the directory with `FRONTEND_DIR`.

For live development prefer the Vite dev server (below), which proxies `/api` to the API and hot-reloads the UI.

### Frontend API client

The React app talks to this API through a typed fetch client (`frontend/src/lib/api.ts`, a port of the legacy `js/api.js`) with thin endpoint modules in `frontend/src/api/`:

- **Catalogue & content:** `products.ts` (`getProducts`, `getFeaturedProducts`, `getProduct`, `getRelatedProducts`, `getCategories`, reviews), `meta.ts` (`getConfig`, `getSettings`, `saveSettings`), `forms.ts` (`subscribe`, `bookConsultation`)
- **Cart & checkout:** `cart.ts` (`ensureCart`, `getCart`, `addToCart`, `updateCartItem`, `removeCartItem`, `validateCart`), `orders.ts` (`placeOrder`, `getOrder`, `getOrders`)
- **Auth & session:** `auth.ts` (`login`, `signup`, `logout`, `getMe`, `updateMe`) + `frontend/src/lib/session.ts`
- **Seller onboarding & admin:** `sellers.ts` (`submitSellerApplication`, `getMySellerContext`, `getSellerDashboard`, admin `getApplications`/`reviewApplication`/`getSellers`/`setSellerStatus`)
- **Returns & notifications:** `returns.ts`, `notifications.ts`

The server cart id is stored in `localStorage` under `spacefitCartId`. `ensureCart()` creates a server cart on first use. The auth session lives under `spacefitSession` (access + refresh token, user and profile) — both keys are unchanged from the legacy site, so existing visitors keep their sessions and carts. The client unwraps the response envelope, refreshes once on `401`, and attaches `X-Dev-User` in dev mode.

### Architecture (Vite / React)

`../frontend` is a Vite + React + TypeScript SPA. The legacy static pages and
their per-page scripts were ported phase-by-phase and deleted at cutover
(`frontend_react_migration_plan.md`); the migration plan doc stays untracked.

- `frontend/index.html` → `src/main.tsx` — entry; Google Fonts + Material
  Symbols load here, Tailwind v3 tokens live in `tailwind.config.js`
  (compiled locally — no CDN scripts)
- `src/appRoutes.tsx` — route table **and** the legacy-URL redirects
  (`.html` aliases, `#hash` links from seeded notifications, email deep
  links `/seller-apply` and `/seller-dashboard`, the `order-succes` typo)
- `src/pages/` — `/`, `/products/:id`, `/cart`, `/checkout`,
  `/order-success/:id`, `/auth`, `/seller-apply`, `/seller-dashboard/:tab`,
  `/admin/:tab`, `/policies`
- `src/layout/` — `StorefrontLayout` / `AuthLayout` / `AdminLayout` /
  `SellerLayout` + shared chrome (`Chrome.tsx`: discount banner, footer,
  toast host; `Header.tsx`: nav, account menu, notifications bell)
- `src/context/` — Auth, Toast, Settings, Notifications, Cart providers
- `src/ui/` — primitives (Button, Input/Select/Textarea/Checkbox, Modal,
  Table, Tabs, StatusPill, Spinner, EmptyState)
- `src/lib/` — typed API client (`api.ts`), `session.ts`, `routes.ts`
  (central nav targets), formatting / permissions helpers
- `src/api/` — endpoint modules listed above

**Dev:** `cd ../frontend && npm install && npm run dev` → http://localhost:5173
with `/api` proxied to the API on `:4000` (run the API in a second terminal —
or from the repo root, `npm run dev` starts both via `concurrently`).

**Build:** `npm run build` in `../frontend` — typecheck (`tsc --noEmit`) +
bundle to `frontend/dist`.

**Serve:** this API serves `frontend/dist` plus the SPA fallback described
above, so production is a single Node process.

**Test:** `npm test` in `../frontend` (Vitest + React Testing Library).

**Optional follow-ups** (port first, refactor after): Playwright browser E2E,
`@tanstack/react-query` for data fetching, Tailwind v4.
