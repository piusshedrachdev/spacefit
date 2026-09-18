import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('reports healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('GET /api/meta/config', () => {
  it('returns storefront config', async () => {
    const res = await request(app).get('/api/meta/config');
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe('NGN');
    expect(res.body.data).toHaveProperty('deliveryFee');
    expect(res.body.data).toHaveProperty('vatRate');
    expect(res.body.data.paymentMethods.map((p) => p.id)).toEqual(['card', 'transfer', 'cash']);
    expect(Array.isArray(res.body.data.serviceableCities)).toBe(true);
  });
});

describe('POST /api/newsletter', () => {
  it('subscribes a new email', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'a@b.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.alreadySubscribed).toBe(false);
  });

  it('reports an existing subscription', async () => {
    await request(app).post('/api/newsletter').send({ email: 'a@b.com' });
    const res = await request(app).post('/api/newsletter').send({ email: 'A@B.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.alreadySubscribed).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'nope' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/consultations', () => {
  it('books a consultation', async () => {
    const res = await request(app).post('/api/consultations').send({
      fullName: 'Ada Obi',
      email: 'ada@example.com',
      phone: '+2348011112222',
      city: 'Lagos',
      roomType: 'Living Room',
      notes: 'Large bay window'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.id).toBeTruthy();
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/consultations').send({ fullName: 'Ada' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('city');
  });
});

describe('Unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
