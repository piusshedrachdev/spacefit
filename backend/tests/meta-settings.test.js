import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const ADMIN = 'dev-user-admin';

describe('GET /api/meta/settings', () => {
  it('returns the default policies and discounts', async () => {
    const res = await request(app).get('/api/meta/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.policies).toHaveProperty('returnPolicy');
    expect(res.body.data.discounts).toHaveProperty('sitewidePercent');
  });
});

describe('PUT /api/meta/settings', () => {
  it('round-trips an admin policy edit', async () => {
    const res = await request(app)
      .put('/api/meta/settings')
      .set('X-Dev-User', ADMIN)
      .send({ policies: { returnPolicy: 'Updated 14-day return window.' } });

    expect(res.status).toBe(200);
    expect(res.body.data.policies.returnPolicy).toBe('Updated 14-day return window.');

    const readBack = await request(app).get('/api/meta/settings');
    expect(readBack.body.data.policies.returnPolicy).toBe('Updated 14-day return window.');
  });

  it('round-trips a discount edit', async () => {
    const res = await request(app)
      .put('/api/meta/settings')
      .set('X-Dev-User', ADMIN)
      .send({ discounts: { sitewidePercent: 15, promoCode: 'SPACE15', bannerEnabled: true } });

    expect(res.status).toBe(200);
    expect(res.body.data.discounts.sitewidePercent).toBe(15);
    expect(res.body.data.discounts.promoCode).toBe('SPACE15');
    expect(res.body.data.discounts.bannerEnabled).toBe(true);
  });

  it('rejects an empty body', async () => {
    const res = await request(app)
      .put('/api/meta/settings')
      .set('X-Dev-User', ADMIN)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-object policies', async () => {
    const res = await request(app)
      .put('/api/meta/settings')
      .set('X-Dev-User', ADMIN)
      .send({ policies: 'not-an-object' });
    expect(res.status).toBe(400);
  });
});
