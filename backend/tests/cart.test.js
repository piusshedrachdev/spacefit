import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function newCart() {
  const res = await request(app).post('/api/cart');
  return res.body.data.id;
}

describe('Cart lifecycle', () => {
  it('creates an empty cart', async () => {
    const res = await request(app).post('/api/cart');
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.subtotal).toBe(0);
    expect(res.body.data.id).toBeTruthy();
  });

  it('adds an item and computes totals', async () => {
    const cartId = await newCart();
    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'luna-bed', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.subtotal).toBe(900000);
    expect(res.body.data.total).toBe(res.body.data.subtotal + res.body.data.delivery + res.body.data.vat);
  });

  it('increments quantity for duplicate add', async () => {
    const cartId = await newCart();
    await request(app).post(`/api/cart/${cartId}/items`).send({ productId: 'nordic-desk', quantity: 1 });
    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'nordic-desk', quantity: 1 });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it('rejects an invalid product id', async () => {
    const cartId = await newCart();
    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'nope', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('rejects missing productId with 422', async () => {
    const cartId = await newCart();
    const res = await request(app).post(`/api/cart/${cartId}/items`).send({ quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('productId');
  });

  it('updates item quantity', async () => {
    const cartId = await newCart();
    const add = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'nordic-desk', quantity: 1 });
    const key = add.body.data.items[0].key;

    const res = await request(app)
      .patch(`/api/cart/${cartId}/items/${encodeURIComponent(key)}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it('removes an item when quantity drops to zero', async () => {
    const cartId = await newCart();
    const add = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'nordic-desk', quantity: 2 });
    const key = add.body.data.items[0].key;

    const res = await request(app)
      .patch(`/api/cart/${cartId}/items/${encodeURIComponent(key)}`)
      .send({ quantity: 0 });
    expect(res.body.data.items).toHaveLength(0);
  });

  it('deletes an item', async () => {
    const cartId = await newCart();
    const add = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'kanso-wardrobe', quantity: 1 });
    const key = add.body.data.items[0].key;

    const res = await request(app).delete(`/api/cart/${cartId}/items/${encodeURIComponent(key)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns 404 for an unknown cart', async () => {
    const res = await request(app).get('/api/cart/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('applies free delivery above threshold', async () => {
    const cartId = await newCart();
    const res = await request(app)
      .post(`/api/cart/${cartId}/items`)
      .send({ productId: 'kanso-wardrobe', quantity: 2 });
    expect(res.body.data.delivery).toBe(0);
  });

  it('validates an empty cart as invalid', async () => {
    const cartId = await newCart();
    const res = await request(app).post(`/api/cart/${cartId}/validate`);
    expect(res.status).toBe(400);
  });
});
