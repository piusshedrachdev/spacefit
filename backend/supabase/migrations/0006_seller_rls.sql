-- SpaceFit Row Level Security — seller ecosystem
-- Depends on 0002_rls_policies.sql (public.is_admin() helper) and
-- 0005_seller_ecosystem.sql (tables).
--
-- The Express backend performs most seller/admin mutations through the
-- service-role key (which bypasses RLS); these policies additionally allow
-- safe direct-from-frontend access where it is useful (a seller reading their
-- own rows, an applicant reading their own application, public settings reads).

-- Helpers ---------------------------------------------------------------

-- Is the current user an approved, unblocked seller?
create or replace function public.is_active_seller()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sellers
    where user_id = auth.uid() and status = 'active'
  );
$$;

-- Which sellers.id belongs to the current user (null when none)?
create or replace function public.current_seller_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.sellers where user_id = auth.uid();
$$;

-- --------------------------------------------------------- seller_applications
alter table public.seller_applications enable row level security;

drop policy if exists "seller_applications_insert_own" on public.seller_applications;
create policy "seller_applications_insert_own"
  on public.seller_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "seller_applications_select_own" on public.seller_applications;
create policy "seller_applications_select_own"
  on public.seller_applications for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Reviews (approve/reject) happen through the service role; admins may also
-- update directly from the dashboard.
drop policy if exists "seller_applications_admin_update" on public.seller_applications;
create policy "seller_applications_admin_update"
  on public.seller_applications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------------------------------------------------- sellers
alter table public.sellers enable row level security;

drop policy if exists "sellers_public_read" on public.sellers;
create policy "sellers_public_read"
  on public.sellers for select
  to anon, authenticated
  using (true);

drop policy if exists "sellers_admin_write" on public.sellers;
create policy "sellers_admin_write"
  on public.sellers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sellers_update_own" on public.sellers;
create policy "sellers_update_own"
  on public.sellers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --------------------------------------------------------------- notifications
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts come from the service role; admins may insert directly too.
drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

-- ------------------------------------------------------------- store_settings
alter table public.store_settings enable row level security;

drop policy if exists "store_settings_public_read" on public.store_settings;
create policy "store_settings_public_read"
  on public.store_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "store_settings_admin_write" on public.store_settings;
create policy "store_settings_admin_write"
  on public.store_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------- product_reviews
alter table public.product_reviews enable row level security;

drop policy if exists "product_reviews_public_read" on public.product_reviews;
create policy "product_reviews_public_read"
  on public.product_reviews for select
  to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "product_reviews_insert_authenticated" on public.product_reviews;
create policy "product_reviews_insert_authenticated"
  on public.product_reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "product_reviews_admin_update" on public.product_reviews;
create policy "product_reviews_admin_update"
  on public.product_reviews for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------ return_requests
alter table public.return_requests enable row level security;

drop policy if exists "return_requests_seller_read" on public.return_requests;
create policy "return_requests_seller_read"
  on public.return_requests for select
  to authenticated
  using (seller_id = public.current_seller_id() or public.is_admin());

drop policy if exists "return_requests_seller_update" on public.return_requests;
create policy "return_requests_seller_update"
  on public.return_requests for update
  to authenticated
  using (seller_id = public.current_seller_id() or public.is_admin())
  with check (seller_id = public.current_seller_id() or public.is_admin());

-- Insertions happen server-side when a customer files a return.

-- ------------------------------------------------------------------- products
-- Extend the write model: active sellers may insert their own listings and
-- manage (update/delete) rows they own. Admin policies from 0002 still apply.

drop policy if exists "products_seller_insert" on public.products;
create policy "products_seller_insert"
  on public.products for insert
  to authenticated
  with check (public.is_active_seller() and seller_id = public.current_seller_id());

drop policy if exists "products_owner_update" on public.products;
create policy "products_owner_update"
  on public.products for update
  to authenticated
  using (public.is_admin() or seller_id = public.current_seller_id())
  with check (public.is_admin() or seller_id = public.current_seller_id());

drop policy if exists "products_owner_delete" on public.products;
create policy "products_owner_delete"
  on public.products for delete
  to authenticated
  using (public.is_admin() or seller_id = public.current_seller_id());

-- Sellers manage their listings' images the same way.
drop policy if exists "product_images_owner_write" on public.product_images;
create policy "product_images_owner_write"
  on public.product_images for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = public.current_seller_id()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = public.current_seller_id()
    )
  );
