# Supabase Setup

This directory holds the PostgreSQL schema, Row Level Security (RLS)
policies, Storage buckets and seed data for SpaceFit, following
`supabase-integration-guide.md`.

## Layout

    supabase/
      migrations/
        0001_init_schema.sql   # tables, indexes, triggers, profile auto-create
        0002_rls_policies.sql  # RLS enable + per-operation policies
        0003_storage.sql       # product-images (public) + avatars (private)
        0004_seed.sql          # categories + products

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
      +-- profiles          (1:1, auto-created by trigger)
      +-- carts -- cart_items -- products
      +-- orders -- order_items -- products
      +-- consultations
    products -- categories
    products -- product_images
    newsletter_subscribers (standalone)

