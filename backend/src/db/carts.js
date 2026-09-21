import { getSupabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';
import { throwIfError } from './errors.js';

/** Compute totals for a cart row plus its items. */
export function summariseCart(cart, items) {
  const mapped = items.map((i) => ({
    key: [i.product_id, i.size || '', i.color || ''].join('::'),
    productId: i.product_id,
    name: i.products?.title || null,
    price: Number(i.products?.price ?? 0),
    image:
      (i.products?.product_images || []).sort((a, b) => a.position - b.position)[0]?.url ||
      null,
    quantity: i.quantity,
    size: i.size,
    color: i.color
  }));

  const subtotal = mapped.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const delivery = subtotal >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;
  const vat = Math.round(subtotal * config.vatRate);

  return {
    id: cart.id,
    items: mapped,
    itemCount: mapped.reduce((n, i) => n + i.quantity, 0),
    currency: config.currency,
    subtotal,
    delivery,
    vat,
    total: subtotal + delivery + vat,
    freeDeliveryThreshold: config.freeDeliveryThreshold,
    updatedAt: cart.updated_at
  };
}

const CART_ITEM_SELECT = `
  id, product_id, quantity, size, color,
  products ( title, price, product_images(url, position) )
`;

/** Load a cart and its items. Throws 404 when the cart does not exist. */
async function loadCart(cartId) {
  const supabase = getSupabaseAdmin();
  const { data: cart, error } = await supabase
    .from('carts')
    .select('id, user_id, created_at, updated_at')
    .eq('id', cartId)
    .maybeSingle();

  throwIfError({ error }, `fetch cart '${cartId}'`);
  if (!cart) throw ApiError.notFound(`Cart '${cartId}' not found`);

  const { data: items, error: itemsError } = await supabase
    .from('cart_items')
    .select(CART_ITEM_SELECT)
    .eq('cart_id', cartId);

  throwIfError({ error: itemsError }, `fetch cart '${cartId}' items`);
  return summariseCart(cart, items || []);
}

/** Create an empty cart, optionally attached to a user. */
export async function createCart({ userId = null } = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id, user_id, created_at, updated_at')
    .single();

  throwIfError({ error }, 'create cart');
  return summariseCart(data, []);
}

/** Fetch a cart by id with computed totals. */
export async function getCart(cartId) {
  return loadCart(cartId);
}

/** Add (or increment) a line item. */
export async function addCartItem(cartId, { productId, quantity = 1, size, color }) {
  const supabase = getSupabaseAdmin();

  // Verify the cart exists first so we fail with a clean 404.
  const { data: cart, error: cartError } = await supabase
    .from('carts')
    .select('id')
    .eq('id', cartId)
    .maybeSingle();
  throwIfError({ error: cartError }, `fetch cart '${cartId}'`);
  if (!cart) throw ApiError.notFound(`Cart '${cartId}' not found`);

  // Look up the existing line with the same product + options.
  const baseQuery = supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('product_id', productId);

  const { data: existing, error: findError } = await eqOrNull(
    eqOrNull(baseQuery, 'size', size),
    'color',
    color
  ).maybeSingle();
  throwIfError({ error: findError }, `add item to cart '${cartId}'`);

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + Number(quantity) })
      .eq('id', existing.id);
    throwIfError({ error }, `add item to cart '${cartId}'`);
  } else {
    const { error } = await supabase.from('cart_items').insert({
      cart_id: cartId,
      product_id: productId,
      quantity: Number(quantity),
      size: size ?? null,
      color: color ?? null
    });
    throwIfError({ error }, `add item to cart '${cartId}'`);
  }

  // Touch the cart so updated_at reflects the change.
  await supabase.from('carts').update({ updated_at: new Date().toISOString() }).eq('id', cartId);

  return loadCart(cartId);
}

/** Update the quantity of an existing line. Quantity <= 0 removes it. */
export async function updateCartItem(cartId, itemKey, quantity) {
  const supabase = getSupabaseAdmin();
  const [productId, size, color] = parseItemKey(itemKey);

  const baseQuery = supabase
    .from('cart_items')
    .select('id')
    .eq('cart_id', cartId)
    .eq('product_id', productId);
  const { data: existing, error } = await eqOrNull(
    eqOrNull(baseQuery, 'size', size || null),
    'color',
    color || null
  ).maybeSingle();
  throwIfError({ error }, `update cart item '${itemKey}'`);
  if (!existing) throw ApiError.notFound(`Cart item '${itemKey}' not found`);

  if (Number(quantity) <= 0) {
    const { error: delError } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', existing.id);
    throwIfError({ error: delError }, `remove cart item '${itemKey}'`);
  } else {
    const { error: updError } = await supabase
      .from('cart_items')
      .update({ quantity: Number(quantity) })
      .eq('id', existing.id);
    throwIfError({ error: updError }, `update cart item '${itemKey}'`);
  }

  return loadCart(cartId);
}

/** Remove a line item from a cart. */
export async function removeCartItem(cartId, itemKey) {
  const supabase = getSupabaseAdmin();
  const [productId, size, color] = parseItemKey(itemKey);

  const baseQuery = supabase
    .from('cart_items')
    .select('id')
    .eq('cart_id', cartId)
    .eq('product_id', productId);
  const { data: existing, error } = await eqOrNull(
    eqOrNull(baseQuery, 'size', size || null),
    'color',
    color || null
  ).maybeSingle();
  throwIfError({ error }, `remove cart item '${itemKey}'`);
  if (!existing) throw ApiError.notFound(`Cart item '${itemKey}' not found`);

  const { error: delError } = await supabase.from('cart_items').delete().eq('id', existing.id);
  throwIfError({ error: delError }, `remove cart item '${itemKey}'`);

  return loadCart(cartId);
}

/** Delete all items from a cart. */
export async function clearCart(cartId) {
  const supabase = getSupabaseAdmin();

  const { data: cart, error } = await supabase
    .from('carts')
    .select('id')
    .eq('id', cartId)
    .maybeSingle();
  throwIfError({ error }, `fetch cart '${cartId}'`);
  if (!cart) throw ApiError.notFound(`Cart '${cartId}' not found`);

  const { error: delError } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
  throwIfError({ error: delError }, `clear cart '${cartId}'`);

  return loadCart(cartId);
}

/** Split a composite `productId::size::color` key back into its parts. */
function parseItemKey(itemKey) {
  const parts = String(itemKey).split('::');
  return [parts[0], parts[1] || null, parts[2] || null];
}

/**
 * Apply an equality filter that correctly handles NULL values.
 * PostgREST's `.eq(col, null)` produces `col=eq.null`, which never matches;
 * NULL requires `.is(col, null)` instead.
 */
function eqOrNull(query, column, value) {
  return value === null || value === undefined
    ? query.is(column, null)
    : query.eq(column, value);
}
