# Supabase Setup

This directory holds the PostgreSQL schema, Row Level Security (RLS)
policies, Storage buckets and seed data for SpaceFit, following
`supabase-integration-guide.md`.

## Layout

    supabase/
      migrations/
        0001_init_schema.sql          # tables, indexes, triggers, profile auto-create
        0002_rls_policies.sql         # RLS enable + per-operation policies
        0003_storage.sql              # product-images (public) + avatars (private)
        0004_seed.sql                 # categories + products
        0005_seller_ecosystem.sql     # seller_applications, sellers, notifications,
                                      # store_settings, product_reviews,
                                      # return_requests, products.seller_id,
                                      # profiles.role += 'seller'
        0006_seller_rls.sql           # RLS for the seller-ecosystem tables
        0007_seller_seed.sql          # default store_settings + demo seller data
        0008_wishlist.sql             # wishlist table + RLS
        0009_wishlist_rls.sql         # wishlist policies
        0010_server_managed_product_images.sql # image writes stay server-side
        0011_reference_catalogue.sql       # replace catalogue with the four homepage products
        0012_shop_catalogue_additions.sql  # add the four shop products and images

`0011_reference_catalogue.sql` is a catalogue reset: back up the project and pause catalogue writes before applying it. It removes all product rows, clears active cart lines, and preserves order snapshots by setting old `order_items.product_id` values to null.

## Applying the migrations

Option A - Supabase SQL Editor (no CLI):
Open each file in migrations/ in numeric order and run it in
Dashboard -> SQL Editor.

Option B - Supabase CLI:

    supabase link --project-ref <your-project-ref>
    supabase db push

## Configuring the backend

Copy backend/.env.example to backend/.env and fill in:

    USE_SUPABASE=true
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_PUBLISHABLE_KEY=your-publishable-key
    SUPABASE_SECRET_KEY=your-secret-key

SUPABASE_SECRET_KEY (older name: SUPABASE_SERVICE_ROLE_KEY) bypasses RLS and
must never be exposed in frontend code or committed to Git.

Seller image uploads are server-mediated: the browser sends multipart bytes to
`POST /api/products` (or `PATCH /api/products/:id`), and the backend uses the
secret client to write to the public `product-images` bucket. The bucket's
admin-only Storage policy is intentional; do not upload product images directly
from the browser or expose the secret key. The generated public URL is stored
in `public.product_images.url`.

When USE_SUPABASE is not 'true' - or credentials are missing - the API
automatically falls back to the in-memory store so local development and the
test suite work without any cloud project.

## Auth configuration

In Dashboard -> Authentication:

1. Providers -> Email: enable email/password. Decide whether email
   confirmation is required.
2. URL Configuration: set the Site URL and add redirect URLs, e.g.
   http://localhost:4000/auth/callback and your production origin.
3. Email Templates: customise the confirmation and recovery emails.
4. For production, configure a custom SMTP provider (the default hosted
   service is rate-limited and intended for testing).

## Data model

    auth.users
      |
      +-- profiles            (1:1, auto-created by trigger; role: customer | seller | admin)
      +-- carts -- cart_items -- products
      +-- orders -- order_items -- products
      +-- consultations
      +-- notifications       (type, title, body, link, read_at)
      +-- product_reviews     (rating 1-5, comment, status: published | hidden)
      +-- seller_applications (status: pending | approved | rejected)
      |
      +-- sellers  <----------+ (1 row per approved application; promotes profiles.role)
            |
            +-- products.seller_id   (null = platform-owned catalogue item)
            +-- return_requests      (status: requested | approved | rejected | completed)

    products -- categories
    products -- product_images
    store_settings            (key/value: 'policies', 'discounts')
    newsletter_subscribers    (standalone)

### Notes

- Approving a `seller_applications` row creates the `sellers` row and flips
  `profiles.role` to `'seller'` in the same transaction (see
  `0007_seller_seed.sql` for the promotion SQL and demo data).
- Blocking a seller flips `sellers.status` only, so history is preserved.
- `store_settings` is read publicly by `GET /api/meta/settings` (footer policy
  links, discount banner) and written by admins from `admin.html`.
- Seller stats (units, revenue, rating, returns) are derived from
  `order_items` -> `products.seller_id`, `product_reviews` and `return_requests`.
- Migration `0011_reference_catalogue.sql` replaces the product catalogue. It
  makes `order_items.product_id` nullable with `ON DELETE SET NULL` so
  historical order name/price/quantity snapshots survive a catalogue reset;
  active cart lines are cleared before product ids are reused.
- Migration `0012_shop_catalogue_additions.sql` additively inserts the four
  additional shop products and replaces only their product-image metadata.

