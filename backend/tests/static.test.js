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

  // Post-cutover replacement for the legacy `/js/api.js` assertion: the entry
  // HTML plus a hashed asset from dist/assets are what actually gets served.
  it('serves the entry HTML and a built asset', async () => {
    const html = await request(app).get('/index.html');
    expect(html.status).toBe(200);
    expect(html.text).toMatch(/SpaceFit/i);

    const assets = fs.readdirSync(path.join(frontendDir, 'assets'));
    const bundle = assets.find((name) => name.endsWith('.js'));
    expect(bundle, 'dist/assets should contain a JS bundle').toBeTruthy();
    const res = await request(app).get('/assets/' + bundle);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  // A clean path with no file behind it is a client-side route: the SPA shell
  // renders it (the client renders the cart UI, so the shell itself carries
  // the app title, not the word "cart").
  it('serves a client-side route by clean path (/cart via the SPA shell)', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/SpaceFit/i);
  });

  it('does not shadow API routes with static files', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  // Safety net: every legacy `.html` URL stays resolvable — the shell is
  // served directly (entry) or through the SPA fallback (client redirect).
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

  // Plan §2: the `/totally-missing` expectation flips from the 404 envelope
  // to the SPA shell at cutover — the client router renders its own 404 page.
  it('hands unknown paths the SPA shell (the client router renders its 404 page)', async () => {
    const res = await request(app).get('/totally-missing');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/SpaceFit/i);
  });

  // ...while the 404 envelope stays for unknown /api/* routes and for
  // missing assets (the fallback only covers extensionless + .html paths).
  it('keeps the JSON 404 envelope for unknown API routes and missing assets', async () => {
    const api = await request(app).get('/api/totally-missing');
    expect(api.status).toBe(404);
    expect(api.body.success).toBe(false);

    const asset = await request(app).get('/assets/missing.js');
    expect(asset.status).toBe(404);
    expect(asset.body.success).toBe(false);
  });
});
