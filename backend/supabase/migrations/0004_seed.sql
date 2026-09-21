-- SpaceFit seed data (categories + products).
-- Idempotent: safe to re-run.

insert into public.categories (name, slug) values
  ('Beds', 'beds'),
  ('Desks', 'desks'),
  ('Mattresses', 'mattresses'),
  ('Storage', 'storage'),
  ('Rugs', 'rugs'),
  ('Lighting', 'lighting')
on conflict (slug) do nothing;

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
  ('luna-bed', 'Luna Upholstered Queen Bed', 'luna-bed', 'beds', 450000, null::numeric, 4.8, 128, 'In stock',
   'A sculptural upholstered queen bed with a soft, curved headboard.',
   'A low-profile upholstered queen bed with a softly curved headboard, deep foam padding and a solid beech frame.',
   '["Solid beech hardwood frame","High-resilience foam padding","Stain-resistant performance fabric","Slatted base, no box spring required"]',
   '[{"label":"Dimensions","value":"210 x 165 x 95 cm"},{"label":"Material","value":"Beech, foam, performance fabric"}]',
   '[{"name":"Oat","hex":"#e7ded0"},{"name":"Charcoal","hex":"#3d3a37"},{"name":"Sage","hex":"#a8b5a0"}]',
   '["Queen","King","Super King"]', true),
  ('nordic-desk', 'Nordic Ergonomic Oak Desk', 'nordic-desk', 'desks', 185000, 210000, 4.7, 94, 'In stock',
   'Solid oak work desk with cable management and an ergonomic profile.',
   'A solid oak writing desk with a gently tapered profile and integrated cable channel.',
   '["Solid oak top","Integrated cable management","Ergonomic rounded edge","Powder-coated steel legs"]',
   '[{"label":"Dimensions","value":"140 x 65 x 75 cm"},{"label":"Material","value":"Oak, steel"}]',
   '[{"name":"Natural Oak","hex":"#c9a227"},{"name":"Walnut","hex":"#6b4a2b"}]',
   '["140 cm","160 cm"]', true),
  ('cloudrest-mattress', 'CloudRest Memory Hybrid Mattress', 'cloudrest-mattress', 'mattresses', 240000, null, 4.9, 212, 'In stock',
   'Hybrid memory-foam mattress with pocket springs for cooling support.',
   'A hybrid mattress combining cooling memory foam with individually pocketed springs.',
   '["Cooling gel memory foam","Individually pocketed springs","Motion isolation","10-year warranty"]',
   '[{"label":"Dimensions","value":"200 x 150 x 28 cm"},{"label":"Firmness","value":"Medium"}]',
   '[{"name":"White","hex":"#f5f5f5"}]',
   '["Double","Queen","King"]', true),
  ('kanso-wardrobe', 'Kanso Minimalist 3-Door Wardrobe', 'kanso-wardrobe', 'storage', 380000, null, 4.6, 58, 'In stock',
   'A clean-lined three-door wardrobe with soft-close hardware.',
   'A minimalist three-door wardrobe with full-height doors and soft-close hinges.',
   '["Soft-close doors","Adjustable shelving","Anti-tip hardware","Matte finish"]',
   '[{"label":"Dimensions","value":"180 x 60 x 220 cm"},{"label":"Material","value":"Engineered wood"}]',
   '[{"name":"Cloud White","hex":"#f2f2f2"},{"name":"Warm Grey","hex":"#8d8a85"}]',
   '["180 cm","220 cm"]', false),
  ('arlo-nightstand', 'Arlo Floating Walnut Nightstand', 'arlo-nightstand', 'storage', 65000, null, 4.7, 76, 'In stock',
   'Wall-mounted walnut nightstand with a floating silhouette.',
   'A wall-mounted walnut nightstand with a soft-close drawer and a generous open shelf.',
   '["Wall-mounted","Soft-close drawer","Solid walnut veneer","Open shelf"]',
   '[{"label":"Dimensions","value":"145 x 28 x 28 cm"},{"label":"Style","value":"Architectural Modern"}]',
   '[{"name":"Walnut","hex":"#6b4a2b"}]',
   '["Single"]', true),
  ('sahara-rug', 'Sahara Handwoven Wool Rug', 'sahara-rug', 'rugs', 140000, null, 4.8, 43, 'In stock',
   'Handwoven wool rug with a subtle desert-toned pattern.',
   'A handwoven wool rug in warm desert tones with a low pile.',
   '["Handwoven wool","Low pile","Natural dyes","Non-slip backing"]',
   '[{"label":"Dimensions","value":"240 x 170 cm"},{"label":"Material","value":"100% wool"}]',
   '[{"name":"Sand","hex":"#d9c7a3"},{"name":"Terracotta","hex":"#b45f3f"}]',
   '["170x240","200x300"]', true),
  ('vesper-lamp', 'Vesper Brass Floor Lamp', 'vesper-lamp', 'lighting', 82000, null, 4.5, 31, 'In stock',
   'Slim brass floor lamp with an adjustable linen shade.',
   'A slim brass floor lamp with an adjustable linen shade and a weighted base.',
   '["Solid brass stem","Linen shade","Adjustable height","Weighted base"]',
   '[{"label":"Dimensions","value":"45 x 45 x 160 cm"},{"label":"Material","value":"Brass, linen"}]',
   '[{"name":"Brass","hex":"#b08d57"}]',
   '["Standard"]', false),
  ('kyoto-bed', 'Kyoto Solid Ash Bed Frame', 'kyoto-bed', 'beds', 520000, null, 4.9, 67, 'Low stock (2 Left)',
   'Low-profile Japanese ash bed frame with traditional joinery.',
   'Low-profile Japanese solid ash bed frame with mortise and tenon joinery.',
   '["Mortise & tenon joinery","Solid Japanese ash timber","Integrated headboard side ledges","Low-profile Japandi silhouette"]',
   '[{"label":"Dimensions","value":"215 x 170 x 80 cm"},{"label":"Material","value":"Solid ash"}]',
   '[{"name":"Ash","hex":"#d6cbb8"},{"name":"Dark Ash","hex":"#6f6455"}]',
   '["Queen","King"]', true)
) as p(id, title, slug, category_slug, price, orig_price, rating, reviews, availability,
       short_description, description, features, specs, colors, sizes, featured)
join public.categories c on c.slug = p.category_slug
on conflict (id) do nothing;
