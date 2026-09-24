import { getSupabaseAdmin } from '../lib/supabase.js';
import * as productsRepo from './products.js';
import { throwIfError } from './errors.js';

/**
 * Supabase persistence for per-user wishlists (`public.wishlist_items`,
 * migrations 0008/0009). Product rows resolve through productsRepo so the API
 * shape matches the in-memory store exactly; rows whose product was deleted
 * are skipped, mirroring store.listWishlist.
 */

/** Saved products for a user, newest first. */
export async function listWishlist(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  throwIfError({ error }, 'list wishlist');

  const resolved = await Promise.allSettled(
    (data || []).map((row) => productsRepo.getProduct(row.product_id))
  );
  return resolved.flatMap((entry) => {
    if (entry.status === 'fulfilled') return [entry.value];
    if (entry.reason?.status === 404) return []; // product deleted — skip
    throw entry.reason;
  });
}

/** Save a product for a user (idempotent). Returns the resolved product. */
export async function addWishlistItem(userId, productId) {
  const product = await productsRepo.getProduct(productId); // canonical id; 404 when missing
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('wishlist_items').upsert(
    { user_id: userId, product_id: product.id },
    { onConflict: 'user_id,product_id', ignoreDuplicates: true }
  );
  throwIfError({ error }, 'add wishlist item');
  return product;
}

/** Remove a saved product (idempotent). Returns `{ productId, removed }`. */
export async function removeWishlistItem(userId, productId) {
  let id = productId;
  try {
    id = (await productsRepo.getProduct(productId)).id;
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', id)
    .select('product_id');

  throwIfError({ error }, 'remove wishlist item');
  return { productId: id, removed: Boolean(data?.length) };
}
