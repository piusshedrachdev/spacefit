-- Replace the SpaceFit catalogue with the four products visible in the
-- reference homepage (space-fit2/frontend/index.html).
--
-- This is a forward migration because 0004_seed.sql has already been applied
-- in linked environments and its ON CONFLICT DO NOTHING clause will not update
-- existing rows. Run a database backup and pause catalogue writes before
-- applying it.
--
-- Historical orders are retained. order_items already stores a name/price/
-- quantity snapshot, so its product_id is made nullable and detached when old
-- catalogue rows are removed. Carts are emptied because their product_id
-- values would otherwise point at a different product definition.

begin;

lock table public.products, public.cart_items, public.order_items
  in share row exclusive mode;

-- Keep order history while allowing the old catalogue rows to be removed.
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

-- Active carts are not historical records. Clear them before reusing product
-- ids from the replacement catalogue.
delete from public.cart_items;

-- product_images, product_reviews and wishlist_items cascade from products;
-- return_requests.product_id is already configured ON DELETE SET NULL.
-- Managed Storage objects are not deleted here; remove orphaned bucket files
-- separately after verifying the migration and taking a backup.
delete from public.products;

-- Do not expose legacy zero-product categories in the catalogue filter.
delete from public.categories c
where not exists (
  select 1 from public.products p where p.category_id = c.id
);

insert into public.categories (name, slug) values
  ('Beds', 'beds'),
  ('Mattresses', 'mattresses'),
  ('Wardrobes', 'wardrobes'),
  ('Desks', 'desks')
on conflict (slug) do update set name = excluded.name;

insert into public.products (
  id, title, slug, category_id, price, orig_price, currency, rating, reviews,
  availability, short_description, description, features, specs, colors, sizes,
  featured
)
select
  p.id, p.title, p.slug, c.id, p.price, p.orig_price, 'NGN', p.rating, p.reviews,
  p.availability, p.short_description, p.description,
  p.features::jsonb, p.specs::jsonb, p.colors::jsonb, p.sizes::jsonb, p.featured
from (values
  (
    'luna-bed', 'Luna Bed Frame', 'luna-bed', 'beds', 450000, null::numeric,
    0, 0, 'In stock',
    'Natural solid oak with curved headboard and oatmeal bouclé upholstery.',
    'Natural solid oak with curved headboard and oatmeal bouclé upholstery.',
    '["Solid wood frame","Modern profile","Easy assembly"]',
    '[{"label":"Dimensions","value":"200 × 160 × 90 cm"},{"label":"Material","value":"Solid wood"},{"label":"Style","value":"Modern"},{"label":"Assembly","value":"Easy assembly"}]',
    '[]', '[]', true
  ),
  (
    'cloudrest-mattress', 'Comfort Cloud Mattress', 'cloudrest-mattress', 'mattresses',
    180000, null::numeric, 0, 0, 'In stock',
    'Orthopedic dual-layer high density foam with breathable cooling gel.',
    'Orthopedic dual-layer high density foam with breathable cooling gel.',
    '["Memory foam","Pocket spring","Zero motion transfer"]',
    '[{"label":"Dimensions","value":"180 × 200 × 28 cm"},{"label":"Material","value":"Memory foam & pocket spring"},{"label":"Feel","value":"Zero motion transfer"}]',
    '[]', '[]', true
  ),
  (
    'kanso-wardrobe', 'Aspen Solid Wardrobe', 'kanso-wardrobe', 'wardrobes',
    320000, null::numeric, 0, 0, 'In stock',
    'Ash wood finish with integrated hangers and soft-close German hinges.',
    'Ash wood finish with integrated hangers and soft-close German hinges.',
    '["Blonde ash wood","Soft-close German hinges","Modular shelving"]',
    '[{"label":"Dimensions","value":"150 × 210 × 60 cm"},{"label":"Material","value":"Blonde ash wood"},{"label":"Storage","value":"Modular shelving"}]',
    '[]', '[]', true
  ),
  (
    'nordic-desk', 'Novo Work Desk', 'nordic-desk', 'desks',
    150000, null::numeric, 0, 0, 'In stock',
    'Slender tapered legs with cable routing for clean, mindful workspaces.',
    'Slender tapered legs with cable routing for clean, mindful workspaces.',
    '["Sustainably sourced white oak","Cable routing","Beveled perimeter"]',
    '[{"label":"Dimensions","value":"120 × 60 × 75 cm"},{"label":"Material","value":"Sustainably sourced white oak"},{"label":"Shape","value":"Beveled perimeter"}]',
    '[]', '[]', true
  )
) as p(
  id, title, slug, category_slug, price, orig_price, rating, reviews,
  availability, short_description, description, features, specs, colors, sizes,
  featured
)
join public.categories c on c.slug = p.category_slug;

-- The image bytes are already shipped in frontend/public/assets. Store those
-- trusted root-relative URLs in product_images; they are served by Vite and
-- copied into the production frontend bundle.
insert into public.product_images (product_id, url, position)
select p.product_id, p.url, p.position
from (values
  ('luna-bed', '/assets/featured-product/lunabedframe.jpg', 0),
  ('cloudrest-mattress', '/assets/featured-product/cloud-bedding.jpg', 0),
  ('kanso-wardrobe', '/assets/featured-product/solid-wardrobe.jpg', 0),
  ('nordic-desk', '/assets/featured-product/novo-workdesk.jpg', 0)
) as p(product_id, url, position)
join public.products product on product.id = p.product_id;

commit;
