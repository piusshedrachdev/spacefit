-- SpaceFit Row Level Security policies
-- Every exposed table has RLS enabled and explicit per-operation policies.

-- Helper: is the current authenticated user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =================================================================== profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ================================================================= categories
alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
  on public.categories for select
  to anon, authenticated
  using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =================================================================== products
alter table public.products enable row level security;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================== product_images
alter table public.product_images enable row level security;

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read"
  on public.product_images for select
  to anon, authenticated
  using (true);

drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write"
  on public.product_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ====================================================================== carts
alter table public.carts enable row level security;

-- A cart is owned by a user. Anonymous carts are addressed by their UUID and
-- are only reachable through the trusted backend using the service-role key.

drop policy if exists "carts_owner_all" on public.carts;
create policy "carts_owner_all"
  on public.carts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "carts_admin_all" on public.carts;
create policy "carts_admin_all"
  on public.carts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ================================================================= cart_items
alter table public.cart_items enable row level security;

drop policy if exists "cart_items_owner_all" on public.cart_items;
create policy "cart_items_owner_all"
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "cart_items_admin_all" on public.cart_items;
create policy "cart_items_admin_all"
  on public.cart_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===================================================================== orders
alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ================================================================ order_items
alter table public.order_items enable row level security;

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ============================================================= consultations
alter table public.consultations enable row level security;

drop policy if exists "consultations_insert_anyone" on public.consultations;
create policy "consultations_insert_anyone"
  on public.consultations for insert
  to anon, authenticated
  with check (true);

drop policy if exists "consultations_select_own" on public.consultations;
create policy "consultations_select_own"
  on public.consultations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===================================================== newsletter_subscribers
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter_insert_anyone" on public.newsletter_subscribers;
create policy "newsletter_insert_anyone"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (true);

drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read"
  on public.newsletter_subscribers for select
  to authenticated
  using (public.is_admin());
