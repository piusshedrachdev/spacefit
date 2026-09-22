import { getSupabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';
import { slugify } from '../utils/slugify.js';
import { ApiError } from '../utils/http.js';
import { throwIfError } from './errors.js';

const PRODUCT_COLUMNS = `
  id, title, slug, price, orig_price, currency, rating, reviews, availability,
  short_description, description, features, specs, colors, sizes, featured,
  seller_id
`;

/**
 * Build the select clause for a product query.
 * @param {{ filterByCategory?: boolean }} [opts] - when true, the category
 *   embed uses an inner join so `.eq('categories.name', ...)` filters the
 *   top-level product rows. A plain (left) join only filters the embedded
 *   category and returns every product with `category: null` on non-matches.
 */
function productSelect({ filterByCategory = false } = {}) {
  const categoryJoin = filterByCategory ? 'categories!inner(name)' : 'categories ( name )';
  return `${PRODUCT_COLUMNS},
  ${categoryJoin},
  sellers ( shop_name ),
  product_images ( url, position )`;
}

/** Map a DB row to the API shape used by the frontend. */
function mapProduct(row) {
  if (!row) return null;
  const images = (row.product_images || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.categories?.name || null,
    price: Number(row.price),
    origPrice: row.orig_price === null ? null : Number(row.orig_price),
    currency: row.currency,
    rating: Number(row.rating),
    reviews: row.reviews,
    availability: row.availability,
    shortDescription: row.short_description,
    description: row.description,
    features: row.features || [],
    specs: row.specs || [],
    colors: row.colors || [],
    sizes: row.sizes || [],
    images,
    featured: row.featured,
    sellerId: row.seller_id || null,
    sellerName: row.sellers?.shop_name || null
  };
}

/**
 * List products with optional filtering, sorting and pagination.
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function listProducts({ category, search, featured, sort, limit, offset, sellerId } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('products')
    .select(productSelect({ filterByCategory: Boolean(category) }), { count: 'exact' });

  if (category) {
    // Inner join (see productSelect) so this filters products, not just the embed.
    query = query.eq('categories.name', category);
  }

  if (sellerId !== undefined) {
    query = sellerId ? query.eq('seller_id', sellerId) : query.is('seller_id', null);
  }

  if (search) {
    // Escape PostgREST `or` filter special characters by quoting the value.
    const term = String(search).replace(/[%_,()]/g, (m) => `\\${m}`);
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,short_description.ilike.%${term}%`
    );
  }

  if (featured !== undefined) {
    query = query.eq('featured', featured === true || featured === 'true');
  }

  switch (sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'rating':
      query = query.order('rating', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: true });
  }

  const start = Number(offset) || 0;
  if (limit !== undefined && limit !== null) {
    const end = start + Number(limit) - 1;
    query = query.range(start, end);
  } else if (start > 0) {
    query = query.range(start, start + 999);
  }

  const { data, error, count } = await query;
  throwIfError({ error }, 'list products');

  return { items: (data || []).map(mapProduct), total: count ?? (data || []).length };
}

/** Fetch a single product by id or slug. Throws 404 when missing. */
export async function getProduct(idOrSlug) {
  const supabase = getSupabaseAdmin();
  const slug = slugify(idOrSlug);

  // Match by primary key first, then fall back to slug.
  const { data, error } = await supabase
    .from('products')
    .select(productSelect())
    .or(`id.eq.${idOrSlug},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();

  throwIfError({ error }, `fetch product '${idOrSlug}'`);
  if (!data) throw ApiError.notFound(`Product '${idOrSlug}' not found`);
  return mapProduct(data);
}

/** Related products in the same category, padded with featured items. */
export async function getRelatedProducts(idOrSlug, limit = 4) {
  const product = await getProduct(idOrSlug);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('products')
    .select('id, title, price, categories!inner(name), product_images(url, position)')
    .neq('id', product.id)
    .eq('categories.name', product.category)
    .limit(limit);

  throwIfError({ error }, 'fetch related products');

  const related = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    price: Number(row.price),
    category: row.categories?.name || null,
    image:
      (row.product_images || []).sort((a, b) => a.position - b.position)[0]?.url || null
  }));

  if (related.length >= limit) return related;

  // Pad with other featured products not already included.
  const excludeIds = [product.id, ...related.map((r) => r.id)];
  const { data: extra, error: extraError } = await supabase
    .from('products')
    .select('id, title, price, categories(name), product_images(url, position)')
    .eq('featured', true)
    .not('id', 'in', `(${excludeIds.map((id) => `"${id}"`).join(',')})`)
    .limit(limit - related.length);

  throwIfError({ error: extraError }, 'fetch related products');

  return related.concat(
    (extra || []).map((row) => ({
      id: row.id,
      title: row.title,
      price: Number(row.price),
      category: row.categories?.name || null,
      image:
        (row.product_images || []).sort((a, b) => a.position - b.position)[0]?.url || null
    }))
  );
}

/** Category list with product counts. */
export async function listCategories() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('name, products(count)');

  throwIfError({ error }, 'list categories');

  return (data || [])
    .map((row) => ({ name: row.name, count: row.products?.[0]?.count ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------ write support */

/** Find (or create) a category id by name. Returns null when no name given. */
async function resolveCategoryId(name) {
  if (!name) return null;
  const supabase = getSupabaseAdmin();
  const term = String(name).replace(/[%_,()]/g, (m) => `\\${m}`);
  const slug = slugify(name);

  const { data: existing, error: findError } = await supabase
    .from('categories')
    .select('id')
    .or(`name.eq.${term},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();
  throwIfError({ error: findError }, 'resolve category');
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('categories')
    .insert({ name, slug })
    .select('id')
    .single();
  throwIfError({ error: createError }, 'create category');
  return created.id;
}

/** Allocate a unique slug-based product id (title -> "ikeja-console-2"...). */
async function uniqueProductId(title, preferredSlug) {
  const supabase = getSupabaseAdmin();
  const baseId = slugify(preferredSlug || title);
  if (!baseId) throw ApiError.badRequest('A product title is required');

  let id = baseId;
  let suffix = 2;
  // Bounded probe loop; collisions are rare (slugified titles).
  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    throwIfError({ error }, 'check product id');
    if (!data) return id;
    id = `${baseId}-${suffix++}`;
    if (suffix > 100) throw ApiError.conflict('Could not allocate a unique product id');
  }
}

/** Create a product listing (seller or admin). */
export async function createProduct(payload) {
  const supabase = getSupabaseAdmin();
  const id = await uniqueProductId(payload.title, payload.slug);
  const categoryId = await resolveCategoryId(payload.category);

  const { error } = await supabase.from('products').insert({
    id,
    title: payload.title,
    slug: id,
    category_id: categoryId,
    price: Number(payload.price) || 0,
    orig_price: payload.origPrice ?? null,
    currency: payload.currency || config.currency,
    availability: payload.availability || 'In stock',
    short_description: payload.shortDescription || null,
    description: payload.description || null,
    features: payload.features || [],
    specs: payload.specs || [],
    colors: payload.colors || [],
    sizes: payload.sizes || [],
    featured: Boolean(payload.featured),
    seller_id: payload.sellerId || null
  });
  throwIfError({ error }, 'create product');

  const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
  if (images.length) {
    const { error: imagesError } = await supabase
      .from('product_images')
      .insert(images.map((url, position) => ({ product_id: id, url, position })));
    throwIfError({ error: imagesError }, 'create product images');
  }

  return getProduct(id);
}

/** Update editable fields on a product (owner or admin enforced upstream). */
export async function updateProduct(idOrSlug, patch) {
  const supabase = getSupabaseAdmin();
  const existing = await getProduct(idOrSlug); // throws 404 when missing

  const updates = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.price !== undefined) updates.price = Number(patch.price) || 0;
  if (patch.origPrice !== undefined) updates.orig_price = patch.origPrice;
  if (patch.availability !== undefined) updates.availability = patch.availability;
  if (patch.shortDescription !== undefined) updates.short_description = patch.shortDescription;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.features !== undefined) updates.features = patch.features;
  if (patch.specs !== undefined) updates.specs = patch.specs;
  if (patch.colors !== undefined) updates.colors = patch.colors;
  if (patch.sizes !== undefined) updates.sizes = patch.sizes;
  if (patch.featured !== undefined) updates.featured = Boolean(patch.featured);
  if (patch.category !== undefined) updates.category_id = await resolveCategoryId(patch.category);

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('products').update(updates).eq('id', existing.id);
    throwIfError({ error }, `update product '${existing.id}'`);
  }

  if (Array.isArray(patch.images)) {
    await supabase.from('product_images').delete().eq('product_id', existing.id);
    const images = patch.images.filter(Boolean);
    if (images.length) {
      const { error: imagesError } = await supabase
        .from('product_images')
        .insert(images.map((url, position) => ({ product_id: existing.id, url, position })));
      throwIfError({ error: imagesError }, 'update product images');
    }
  }

  return getProduct(existing.id);
}

/** Delete a product listing (and its images, via FK cascade). */
export async function deleteProduct(idOrSlug) {
  const supabase = getSupabaseAdmin();
  const existing = await getProduct(idOrSlug);
  const { error } = await supabase.from('products').delete().eq('id', existing.id);
  throwIfError({ error }, `delete product '${existing.id}'`);
  return true;
}
