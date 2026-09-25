import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';

/**
 * Simulate running against Supabase — the mode production and the local .env
 * use (USE_SUPABASE=true) — while keeping data on the in-memory store:
 *
 * - `usingSupabase()` reports true, so guards take their strict branch and
 *   identity comes from bearer tokens via `getUserFromToken` (mocked below).
 * - Every other facade function still resolves through the internal
 *   `backend()` check, which reads the real (memory-mode) config, so products,
 *   sellers and returns stay on the deterministic store fixtures.
 *
 * This file exists because the regular suite pins USE_SUPABASE=false: guards
 * are relaxed no-ops there, which is exactly how `requireSeller` blocking
 * admins on GET /api/returns (and the product routes) shipped undetected.
 */
vi.mock('../src/db/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usingSupabase: () => true };
});

vi.mock('../src/lib/supabase.js', async (importOriginal) => {
  const actual = await importOriginal();
  const users = {
    'admin-token': {
      id: 'dev-user-admin',
      email: 'admin@spacefit.ng',
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'admin' }
    },
    'seller-token': {
      id: 'dev-user-seller',
      email: 'seller@spacefit.ng',
      app_metadata: { role: 'seller' },
      user_metadata: { role: 'seller' }
    },
    'customer-token': {
      id: 'dev-user-customer',
      email: 'customer@spacefit.ng',
      app_metadata: { role: 'customer' },
      user_metadata: { role: 'customer' }
    }
  };
  return { ...actual, getUserFromToken: async (token) => users[token] || null };
});

const app = createApp();

const ADMIN = 'admin-token';
const SELLER = 'seller-token';
const CUSTOMER = 'customer-token';

const OWNED = 'seed-seller-1';

function as(token) {
  return { Authorization: `Bearer ${token}` };
}

function seedReturn(sellerId, overrides = {}) {
  return store.createReturn({
    orderId: 'seed-demo-order',
    productId: 'luna-bed',
    sellerId,
    requestedBy: 'dev-user-customer',
    reason: 'Item arrived damaged.',
    ...overrides
  });
}

describe('GET /api/returns in Supabase mode', () => {
  it('lets an admin list returns across every seller (regression: requireSeller 401d admins)', async () => {
    seedReturn('other-seller-9');

    const res = await request(app).get('/api/returns').set(as(ADMIN));

    expect(res.status).toBe(200);
    const sellerIds = res.body.data.map((r) => r.sellerId);
    expect(sellerIds).toContain(OWNED);
    expect(sellerIds).toContain('other-seller-9');
  });

  it('lets an admin update a return (regression: PATCH was seller-only too)', async () => {
    const record = seedReturn('other-seller-9');

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set(as(ADMIN))
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  it('scopes a seller to their own shop', async () => {
    seedReturn('other-seller-9');

    const res = await request(app).get('/api/returns').set(as(SELLER));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((r) => r.sellerId === OWNED)).toBe(true);
  });

  it('rejects a customer', async () => {
    const res = await request(app).get('/api/returns').set(as(CUSTOMER));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });

  it('requires a session', async () => {
    const res = await request(app).get('/api/returns');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('blocks a blocked seller but lets the admin through', async () => {
    store.updateSeller(OWNED, { status: 'blocked' });

    const blocked = await request(app).get('/api/returns').set(as(SELLER));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.message).toBe('Seller account is blocked');

    const admin = await request(app).get('/api/returns').set(as(ADMIN));
    expect(admin.status).toBe(200);
  });
});

describe('product management in Supabase mode', () => {
  function newProduct(overrides = {}) {
    return {
      title: 'Test Walnut Stool',
      category: 'Seating',
      price: 45000,
      shortDescription: 'A compact solid walnut stool.',
      description: 'Hand-finished solid walnut stool for kitchen islands and vanities.',
      features: ['Solid walnut', 'Hand-finished'],
      specs: [{ label: 'Height', value: '65 cm' }],
      colors: [{ name: 'Walnut', hex: '#5b3a29' }],
      sizes: ['Standard'],
      availability: 'In stock',
      ...overrides
    };
  }

  it('lets an admin edit any listing (regression: requireSeller 401d admins)', async () => {
    const res = await request(app)
      .patch('/api/products/luna-bed')
      .set(as(ADMIN))
      .send({ price: 99000 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(99000);
  });

  it('lets an admin delete a listing (regression: same seller-only guard)', async () => {
    const res = await request(app).delete('/api/products/luna-bed').set(as(ADMIN));

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('lets an admin create a featured listing (regression: same seller-only guard)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(as(ADMIN))
      .send(newProduct({ featured: true }));

    expect(res.status).toBe(201);
    expect(res.body.data.sellerId).toBeNull();
    expect(res.body.data.featured).toBe(true);
  });

  it('rejects a customer trying to edit a listing', async () => {
    const res = await request(app)
      .patch('/api/products/luna-bed')
      .set(as(CUSTOMER))
      .send({ price: 1 });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });

  it('requires a session for edits', async () => {
    const res = await request(app).patch('/api/products/luna-bed').send({ price: 1 });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('blocks a blocked seller from editing listings', async () => {
    store.updateSeller(OWNED, { status: 'blocked' });

    const res = await request(app)
      .patch('/api/products/luna-bed')
      .set(as(SELLER))
      .send({ price: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Seller account is blocked');
  });
});
