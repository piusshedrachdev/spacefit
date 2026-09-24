-- Row-level security for public.wishlist_items (owner-only, any role).
-- The API writes through the service role (bypasses RLS); these policies
-- govern direct Supabase access from authenticated clients.

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist_items_owner_all" on public.wishlist_items;
create policy "wishlist_items_owner_all"
  on public.wishlist_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
