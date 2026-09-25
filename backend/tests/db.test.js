import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from '../src/db/index.js';
import { isSupabaseConfigured } from '../src/lib/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');

describe('db facade', () => {
  it('reports the active backend', () => {
    // No credentials in the test environment -> in-memory fallback.
    expect(db.usingSupabase()).toBe(false);
    expect(isSupabaseConfigured).toBe(false);
  });

  it('serves products from the in-memory store when Supabase is off', async () => {
    const { items, total } = await db.listProducts({});
    expect(total).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('id');
  });

  it('exposes every data operation as an async function', () => {
    const ops = [
      'listProducts',
      'getProduct',
      'getRelatedProducts',
      'listCategories',
      'createCart',
      'getCart',
      'addCartItem',
      'updateCartItem',
      'removeCartItem',
      'clearCart',
      'createOrder',
      'getOrder',
      'listOrders',
      'updateOrderStatus',
      'createConsultation',
      'listConsultations',
      'subscribe'
    ];
    for (const op of ops) {
      expect(typeof db[op]).toBe('function');
    }
  });

  it('round-trips a cart through the facade', async () => {
    const cart = await db.createCart();
    expect(cart.items).toEqual([]);

    const updated = await db.addCartItem(cart.id, { productId: 'luna-bed', quantity: 2 });
    expect(updated.itemCount).toBe(2);

    const fetched = await db.getCart(cart.id);
    expect(fetched.items).toHaveLength(1);
  });
});

describe('supabase migrations', () => {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  it('ships the expected migration files', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.some((f) => f.includes('init_schema'))).toBe(true);
    expect(files.some((f) => f.includes('rls_policies'))).toBe(true);
    expect(files.some((f) => f.includes('storage'))).toBe(true);
    expect(files.some((f) => f.includes('seed'))).toBe(true);
  });

  it('creates every application table', () => {
    const schema = readFileSync(path.join(migrationsDir, '0001_init_schema.sql'), 'utf8');
    for (const table of [
      'profiles',
      'categories',
      'products',
      'product_images',
      'carts',
      'cart_items',
      'orders',
      'order_items',
      'consultations',
      'newsletter_subscribers'
    ]) {
      expect(schema).toContain(`public.${table}`);
    }
  });

  it('enables RLS on every exposed table', () => {
    const rls = readFileSync(path.join(migrationsDir, '0002_rls_policies.sql'), 'utf8');
    for (const table of [
      'profiles',
      'categories',
      'products',
      'product_images',
      'carts',
      'cart_items',
      'orders',
      'order_items',
      'consultations',
      'newsletter_subscribers'
    ]) {
      expect(rls).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('creates both storage buckets', () => {
    const storage = readFileSync(path.join(migrationsDir, '0003_storage.sql'), 'utf8');
    expect(storage).toContain("'product-images'");
    expect(storage).toContain("'avatars'");
  });

  it('keeps product image metadata writes server-managed', () => {
    const migration = readFileSync(
      path.join(migrationsDir, '0010_server_managed_product_images.sql'),
      'utf8'
    );
    expect(migration).toContain('product_images_admin_write');
    expect(migration).toContain('product_images_owner_write');
  });
});
