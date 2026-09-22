import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const validOrder = {
  items: [{ productId: 'luna-bed', quantity: 1 }],
  customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+2348012345678' },
  delivery: { address: '123 Example Street', city: 'Lagos', state: 'Lagos' },
  paymentMethod: 'card'
};

describe('POST /api/orders', () => {
  it('creates an order and returns totals', async () => {
    const res = await request(app).post('/api/orders').send(validOrder);
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^SF-/);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.subtotal).toBe(450000);
    expect(res.body.data.total).toBe(
      res.body.data.subtotal + res.body.data.deliveryFee + res.body.data.vat
    );
    expect(res.body.data.status).toBe('pending');
  });

  it('accepts flat form fields from checkout.html', async () => {
    const res = await request(app).post('/api/orders').send({
      items: [{ productId: 'arlo-nightstand', quantity: 2 }],
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+2348099999999',
      address: '5 Marina Road',
      city: 'Abuja',
      state: 'FCT',
      paymentMethod: 'transfer'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.customer.email).toBe('jane@example.com');
    expect(res.body.data.items[0].quantity).toBe(2);
  });

  it('builds an order from a server cart and clears it', async () => {
    const cart = await request(app).post('/api/cart');
    const cartId = cart.body.data.id;
    await request(app).post(`/api/cart/${cartId}/items`).send({ productId: 'vesper-lamp', quantity: 1 });

    const res = await request(app)
      .post('/api/orders')
      .send({ ...validOrder, items: undefined, cartId });
    expect(res.status).toBe(201);

    const after = await request(app).get(`/api/cart/${cartId}`);
    expect(after.status).toBe(404);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validOrder, customer: { ...validOrder.customer, email: 'bad' } });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('rejects an invalid payment method', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validOrder, paymentMethod: 'crypto' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('paymentMethod');
  });

  it('rejects an empty order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validOrder, items: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders', () => {
  it('retrieves an order by id', async () => {
    const created = await request(app).post('/api/orders').send(validOrder);
    const id = created.body.data.id;

    const res = await request(app).get(`/api/orders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('returns 404 for unknown order', async () => {
    const res = await request(app).get('/api/orders/nope');
    expect(res.status).toBe(404);
  });

  it('lists orders', async () => {
    // The store seeds demo data (including a delivered demo order),
    // so assert relative to the baseline instead of a fixed count.
    const before = await request(app).get('/api/orders');
    expect(before.status).toBe(200);
    const baseline = before.body.data.length;

    const created = await request(app).post('/api/orders').send(validOrder);
    expect(created.status).toBe(201);

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(baseline + 1);
    expect(res.body.data.map((o) => o.id)).toContain(created.body.data.id);
  });
});
