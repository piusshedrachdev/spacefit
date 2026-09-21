import { getSupabaseAdmin } from '../lib/supabase.js';
import { slugify } from '../utils/slugify.js';
import { ApiError } from '../utils/http.js';
import { throwIfError } from './errors.js';

const PRODUCT_SELECT = `
  id, title, slug, price, orig_price, currency, rating, reviews, availability,
  short_description, description, features, specs, colors, sizes, featured,
  categories ( name ),
  product_images ( url, position )
`;

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
    featured: row.featured
  };
}

/**
 * List products with optional filtering, sorting and pagination.
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function listProducts({ category, search, featured, sort, limit, offset } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' });

  if (category) {
    // Category filter joins on the categories table's name.
    query = query.eq('categories.name', category);
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
    .select(PRODUCT_SELECT)
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
    .select('id, title, price, categories(name), product_images(url, position)')
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
