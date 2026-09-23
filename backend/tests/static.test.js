import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, frontendDir } from '../src/app.js';
import fs from 'node:fs';
import path from 'node:path';

const app = createApp();

describe('static frontend serving', () => {
  it('resolves a frontend directory that exists', () => {
    expect(fs.existsSync(frontendDir)).toBe(true);
    expect(fs.existsSync(path.join(frontendDir, 'index.html'))).toBe(true);
  });

  it('serves index.html at /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/SpaceFit/i);
  });

  it('serves the API client script', async () => {
    const res = await request(app).get('/js/api.js');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/SpaceFitAPI/);
  });

  it('serves a page by clean path (cart.html via /cart)', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/cart/i);
  });

  it('does not shadow API routes with static files', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('serves every page linked from the shared chrome / navigation', async () => {
    const pages = [
      'index.html',
      'cart.html',
      'checkout.html',
      'product-details.html',
      'order-succes.html',
      'auth.html',
      'seller-apply.html',
      'seller-dashboard.html',
      'admin.html',
      'policies.html'
    ];
    for (const page of pages) {
      const res = await request(app).get('/' + page);
      expect(res.status, page + ' should exist').toBe(200);
      expect(res.text, page).toMatch(/SpaceFit/i);
    }
  });

  it('serves the policies page script and its policy sections', async () => {
    const script = await request(app).get('/js/policies.js');
    expect(script.status).toBe(200);
    expect(script.text).toMatch(/getSettings/);

    const page = await request(app).get('/policies.html');
    for (const anchor of ['id="returns"', 'id="delivery"', 'id="sellers"', 'id="privacy"', 'id="discounts"']) {
      expect(page.text, anchor).toContain(anchor);
    }
  });

  it('returns a 404 envelope for unknown non-file routes', async () => {
    const res = await request(app).get('/totally-missing');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
