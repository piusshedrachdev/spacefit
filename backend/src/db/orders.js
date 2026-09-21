import { getSupabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';
import { throwIfError } from './errors.js';
import { getProduct } from './products.js';
import { getCart } from './carts.js';

/** Short, human-friendly order reference, e.g. SF-LXK9F2. */
function makeReference() {
  return `SF-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;
}

/** Map an order row (+ joined items) to the API shape. */
function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    userId: row.user_id,
    items: (row.order_items || []).map((i) => ({
      productId: i.product_id,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      size: i.size,
      color: i.color
    })),
    customer: row.customer,
    delivery: row.delivery,
    paymentMethod: row.payment_method,
    notes: row.notes,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    vat: Number(row.vat),
    total: Number(row.total),
    createdAt: row.created_at
  };
}

const ORDER_SELECT = `
  id, reference, status, user_id, customer, delivery, payment_method, notes,
  currency, subtotal, delivery_fee, vat, total, created_at,
  order_items ( product_id, name, price, quantity, size, color )
`;

/**
 * Create an order from either explicit items or an existing cart.
 * Prices are always re-read from the database; client-supplied prices are
 * ignored to prevent tampering.
 */
export async function createOrder({
  cartId,
  items: rawItems,
  customer,
  delivery,
  paymentMethod,
  notes,
  userId = null
}) {
  const supabase = getSupabaseAdmin();

  // Resolve the source line items.
  let sourceItems = rawItems;
  if ((!sourceItems || sourceItems.length === 0) && cartId) {
    const cart = await getCart(cartId);
    sourceItems = cart.items;
  }

  if (!sourceItems || sourceItems.length === 0) {
    throw ApiError.badRequest('Order must contain at least one item');
  }

  // Re-price every line against the catalogue.
  const resolved = [];
  for (const item of sourceItems) {
    const productId = item.productId || item.id;
    const product = await getProduct(productId);
    const quantity = Number(item.quantity) || 1;
    if (quantity < 1) {
      throw ApiError.badRequest(`Invalid quantity for '${productId}'`);
    }
    resolved.push({
      productId: product.id,
      name: product.title,
      price: product.price,
      quantity,
      size: item.size || null,
      color: item.color || null
    });
  }

  const subtotal = resolved.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = subtotal >= config.freeDeliveryThreshold ? 0 : config.deliveryFee;
  const vat = Math.round(subtotal * config.vatRate);
  const total = subtotal + deliveryFee + vat;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      reference: makeReference(),
      user_id: userId,
      status: 'pending',
      currency: config.currency,
      subtotal,
      delivery_fee: deliveryFee,
      vat,
      total,
      customer,
      delivery,
      payment_method: paymentMethod,
      notes: notes || null
    })
    .select('id, reference')
    .single();

  throwIfError({ error }, 'create order');

  const lineRows = resolved.map((i) => ({
    order_id: order.id,
    product_id: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    size: i.size,
    color: i.color
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(lineRows);
  if (itemsError) {
    // Roll back the orphaned order header so the DB stays consistent.
    await supabase.from('orders').delete().eq('id', order.id);
    throwIfError({ error: itemsError }, 'create order items');
  }

  // Delete the originating cart now that the order exists.
  // order_items holds a snapshot and orders has no cart_id FK,
  // so the emptied cart row would otherwise accumulate as an orphan.
  if (cartId) {
    await supabase.from('cart_items').delete().eq('cart_id', cartId);
    await supabase.from('carts').delete().eq('id', cartId);
  }

  return getOrder(order.id);
}

/** Fetch a single order by id or reference. */
export async function getOrder(idOrReference) {
  const supabase = getSupabaseAdmin();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrReference
  );

  const query = supabase.from('orders').select(ORDER_SELECT);
  const { data, error } = await (isUuid
    ? query.eq('id', idOrReference)
    : query.eq('reference', idOrReference)
  ).maybeSingle();

  throwIfError({ error }, `fetch order '${idOrReference}'`);
  if (!data) throw ApiError.notFound(`Order '${idOrReference}' not found`);
  return mapOrder(data);
}

/** List orders, newest first. Optionally scoped to a single user. */
export async function listOrders({ userId = null, limit = 100 } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  throwIfError({ error }, 'list orders');
  return (data || []).map(mapOrder);
}

/** Update an order's status (admin action). */
export async function updateOrderStatus(id, status) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  throwIfError({ error }, `update order '${id}' status`);
  return getOrder(id);
}
