-- Product image metadata is written by the trusted backend after it uploads
-- bytes to the product-images Storage bucket. Do not allow authenticated
-- clients to insert arbitrary URL values directly into this table.
--
-- The Express API uses the service-role client, which bypasses RLS, so seller
-- and admin product writes continue to work through the server.

drop policy if exists "product_images_admin_write" on public.product_images;
drop policy if exists "product_images_owner_write" on public.product_images;
