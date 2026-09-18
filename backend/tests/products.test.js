import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/products', () => {
  it('returns all seeded products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/products?category=Beds');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p) => expect(p.category).toBe('Beds'));
  });

  it('searches by title', async () => {
    const res = await request(app).get('/api/products?search=oak');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('sorts by price ascending', async () => {
    const res = await request(app).get('/api/products?sort=price_asc');
    const prices = res.body.data.map((p) => p.price);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it('paginates with limit and offset', async () => {
    const res = await request(app).get('/api/products?limit=2&offset=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.offset).toBe(1);
  });
});

describe('GET /api/products/featured', () => {
  it('returns only featured products', async () => {
    const res = await request(app).get('/api/products/featured');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p) => expect(p.featured).toBe(true));
  });
});

describe('GET /api/products/categories', () => {
  it('returns categories with counts', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('count');
  });
});

describe('GET /api/products/:id', () => {
  it('returns a single product by id', async () => {
    const res = await request(app).get('/api/products/luna-bed');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('luna-bed');
    expect(res.body.data.title).toBe('Luna Upholstered Queen Bed');
    expect(res.body.data).toHaveProperty('specs');
    expect(res.body.data).toHaveProperty('colors');
  });

  it('returns 404 for unknown product', async () => {
    const res = await request(app).get('/api/products/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/products/:id/related', () => {
  it('returns related products excluding the product itself', async () => {
    const res = await request(app).get('/api/products/luna-bed/related');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p) => expect(p.id).not.toBe('luna-bed'));
  });
});
