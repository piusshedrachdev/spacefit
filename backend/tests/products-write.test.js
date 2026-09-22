import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const ADMIN = 'dev-user-admin';
const SELLER = 'dev-user-seller';
const CUSTOMER = 'dev-user-customer';

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
    images: ['/images/test-stool.jpg'],
    availability: 'In stock',
    ...overrides
  };
}

describe('POST /api/products', () => {
  it('creates a listing owned by the calling seller', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct());

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Test Walnut Stool');
    expect(res.body.data.sellerId).toBe('seed-seller-1');
  });

  it('rejects a listing without a price', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct({ price: undefined }));
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('price');
  });

  it('forces featured=false for non-admin sellers', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct({ featured: true }));
    expect(res.status).toBe(201);
    expect(res.body.data.featured).toBe(false);
  });
});

describe('PATCH /api/products/:id', () => {
  it('lets a seller edit their own listing', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct());
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/products/${id}`)
      .set('X-Dev-User', SELLER)
      .send({ price: 52000 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(52000);
  });

  it('denies a non-owner editing a listing', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct());
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/products/${id}`)
      .set('X-Dev-User', CUSTOMER)
      .send({ price: 1 });

    expect(res.status).toBe(403);
  });

  it('lets an admin edit any listing', async () => {
    const res = await request(app)
      .patch('/api/products/ikeja-solid-oak-console-table')
      .set('X-Dev-User', ADMIN)
      .send({ featured: true });
    expect(res.status).toBe(200);
    expect(res.body.data.featured).toBe(true);
  });

  it('rejects an empty patch', async () => {
    const res = await request(app)
      .patch('/api/products/ikeja-solid-oak-console-table')
      .set('X-Dev-User', ADMIN)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/products/:id', () => {
  it('deletes the owner\'s listing', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('X-Dev-User', SELLER)
      .send(newProduct({ title: 'Disposable Shelf' }));
    const id = created.body.data.id;

    const res = await request(app)
      .delete(`/api/products/${id}`)
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const after = await request(app).get(`/api/products/${id}`);
    expect(after.status).toBe(404);
  });

  it('denies a non-owner deleting a listing', async () => {
    const res = await request(app)
      .delete('/api/products/ikeja-solid-oak-console-table')
      .set('X-Dev-User', CUSTOMER);
    expect(res.status).toBe(403);
  });
});
