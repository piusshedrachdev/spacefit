-- SpaceFit — wishlist (per-user saved products).
-- Each row is one saved product; (user_id, product_id) doubles as the primary
-- key and the dedupe rule, so saving the same product twice is a no-op at the
-- storage layer. Product ids are the slug-based text key of public.products,
-- and saving is per auth user (any role).

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists wishlist_items_user_idx
  on public.wishlist_items(user_id, created_at desc);
