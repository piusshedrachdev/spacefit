import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const SELLER = 'dev-user-seller';
const CUSTOMER = 'dev-user-customer';
const ADMIN = 'dev-user-admin';

describe('GET /api/wishlist', () => {
  it('requires an identity', async () => {
    const res = await request(app).get('/api/wishlist');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('starts empty for a new caller', async () => {
    const res = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.count).toBe(0);
  });

  it('lists saved products newest first', async () => {
    const [first, second] = [
      await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER),
      await request(app).post('/api/wishlist/vesper-lamp').set('X-Dev-User', CUSTOMER)
    ];
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const res = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.id)).toEqual(['vesper-lamp', 'luna-bed']);
    expect(res.body.meta.count).toBe(2);
  });

  it('is scoped to the caller', async () => {
    await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);

    const res = await request(app).get('/api/wishlist').set('X-Dev-User', SELLER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /api/wishlist/:productId', () => {
  it('requires an identity', async () => {
    const res = await request(app).post('/api/wishlist/luna-bed');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('saves a product and returns it', async () => {
    const res = await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('luna-bed');

    const list = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);
    expect(list.body.data).toHaveLength(1);
  });

  it('is idempotent for the same product', async () => {
    const first = await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);
    const again = await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);

    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe('luna-bed');

    const list = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);
    expect(list.body.data).toHaveLength(1);
  });

  it('404s an unknown product', async () => {
    const res = await request(app)
      .post('/api/wishlist/no-such-product')
      .set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/wishlist/:productId', () => {
  it('requires an identity', async () => {
    const res = await request(app).delete('/api/wishlist/luna-bed');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('removes a saved product', async () => {
    await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);

    const res = await request(app)
      .delete('/api/wishlist/luna-bed')
      .set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ productId: 'luna-bed', removed: true });

    const list = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);
    expect(list.body.data).toEqual([]);
  });

  it('reports removed=false when the product was not saved (idempotent)', async () => {
    const res = await request(app)
      .delete('/api/wishlist/luna-bed')
      .set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ productId: 'luna-bed', removed: false });
  });

  it('does not remove another caller\'s saved product', async () => {
    await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', CUSTOMER);

    const res = await request(app)
      .delete('/api/wishlist/luna-bed')
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(false);

    const list = await request(app).get('/api/wishlist').set('X-Dev-User', CUSTOMER);
    expect(list.body.data).toHaveLength(1);
  });

  it('allows an admin to manage their own wishlist', async () => {
    await request(app).post('/api/wishlist/luna-bed').set('X-Dev-User', ADMIN);

    const res = await request(app)
      .delete('/api/wishlist/luna-bed')
      .set('X-Dev-User', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(true);
  });
});
