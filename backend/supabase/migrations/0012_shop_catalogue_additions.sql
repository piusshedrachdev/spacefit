-- Add the four additional curated products shown on the reference shop page.
-- Migration 0011 must run first: it establishes the four homepage products and
-- the safe order-item detach behaviour. This migration is additive so a linked
-- production database that already ran 0011 does not need another catalogue
-- reset.

begin;

lock table public.products, public.product_images
  in share row exclusive mode;

insert into public.categories (name, slug) values
  ('Nightstands', 'nightstands'),
  ('Rugs', 'rugs'),
  ('Lighting', 'lighting')
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
    'arlo-nightstand', 'Arlo Floating Walnut Nightstand', 'arlo-nightstand',
    'nightstands', 65000, null::numeric, 4.7, 54, 'In stock',
    'Wall-mounted brass cleat with cable dock groove.',
    'Cantilevered floating American walnut nightstand with cable dock channel.',
    '["Wall-mounted","Cable dock groove","Brass cleat"]',
    '[{"label":"Dimensions","value":"45 × 32 × 25 cm"},{"label":"Material","value":"American walnut & brass cleat"},{"label":"Mounting","value":"Wall mounted"}]',
    '[]', '[]', false
  ),
  (
    'sahara-rug', 'Sahara Handwoven Wool Rug', 'sahara-rug', 'rugs',
    140000, null::numeric, 5, 12, 'In stock',
    'Unbleached mountain wool with non-shedding density.',
    'Handwoven 100% natural mountain wool area rug with subtle Berber motifs.',
    '["100% natural mountain wool","Non-shedding pile","Handwoven"]',
    '[{"label":"Dimensions","value":"240 × 300 cm"},{"label":"Material","value":"100% unbleached mountain wool"},{"label":"Pile","value":"Non-shedding"}]',
    '[]', '[]', false
  ),
  (
    'vesper-lamp', 'Vesper Brass Floor Lamp', 'vesper-lamp', 'lighting',
    82000, null::numeric, 4.8, 31, 'In stock',
    'Solid travertine base with warm dimming toggle.',
    'Architectural floor lamp crafted from brushed solid brass with travertine base.',
    '["Brushed solid brass","Travertine base","Warm dimming toggle"]',
    '[{"label":"Dimensions","value":"145 × 28 × 28 cm"},{"label":"Material","value":"Brushed brass & travertine stone"},{"label":"Light","value":"2700K warm LED"}]',
    '[]', '[]', false
  ),
  (
    'kyoto-bed', 'Kyoto Solid Ash Bed Frame', 'kyoto-bed', 'beds',
    520000, null::numeric, 4.9, 67, 'Low stock (2 Left)',
    'Mortise & tenon joinery with integrated headboard ledge.',
    'Low-profile Japanese solid ash bed frame with mortise and tenon joinery.',
    '["Mortise & tenon joinery","Solid Japanese ash","Integrated headboard ledge"]',
    '[{"label":"Dimensions","value":"215 × 195 × 85 cm"},{"label":"Material","value":"Solid Japanese ash"},{"label":"Style","value":"Japandi minimalist"}]',
    '[]', '[]', false
  )
) as p(
  id, title, slug, category_slug, price, orig_price, rating, reviews,
  availability, short_description, description, features, specs, colors, sizes,
  featured
)
join public.categories c on c.slug = p.category_slug
where true
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  category_id = excluded.category_id,
  price = excluded.price,
  orig_price = excluded.orig_price,
  currency = excluded.currency,
  rating = excluded.rating,
  reviews = excluded.reviews,
  availability = excluded.availability,
  short_description = excluded.short_description,
  description = excluded.description,
  features = excluded.features,
  specs = excluded.specs,
  colors = excluded.colors,
  sizes = excluded.sizes,
  featured = excluded.featured,
  seller_id = null,
  updated_at = now();

-- Replace only these four products' image metadata. The local assets are the
-- byte-identical reference files already present under frontend/public/assets.
delete from public.product_images
where product_id in ('arlo-nightstand', 'sahara-rug', 'vesper-lamp', 'kyoto-bed');

insert into public.product_images (product_id, url, position)
select p.product_id, p.url, p.position
from (values
  ('arlo-nightstand', '/assets/categories/nightstand.jpg', 0),
  ('sahara-rug', '/assets/categories/rugs.jpg', 0),
  ('vesper-lamp', '/assets/carousell/scandinavian-style-home-office.jpg', 0),
  ('kyoto-bed', '/assets/carousell/serene-living-room-sectional-sofa.jpg', 0)
) as p(product_id, url, position)
join public.products product on product.id = p.product_id;

commit;
