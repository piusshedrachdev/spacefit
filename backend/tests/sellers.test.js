import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';

const app = createApp();

const ADMIN = 'dev-user-admin';
const SELLER = 'dev-user-seller';
const CUSTOMER = 'dev-user-customer';

/** Build a valid application payload. */
function applicationPayload(overrides = {}) {
  return {
    fullName: 'Chidi Okeke',
    email: 'chidi@example.com',
    phone: '+2348012345678',
    shopName: 'Chidi Ceramics',
    city: 'Lagos',
    state: 'Lagos',
    deliveryPlaces: ['Lagos', 'Abuja'],
    categories: ['Decor'],
    bio: 'Handmade ceramics.',
    termsAccepted: true,
    disclaimersAccepted: true,
    ...overrides
  };
}

describe('POST /api/sellers/applications', () => {
  it('creates a pending application and notifies admins', async () => {
    const res = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.shopName).toBe('Chidi Ceramics');

    const adminNotifications = store.listNotifications(ADMIN);
    expect(adminNotifications.some((n) => n.type === 'application_received')).toBe(true);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send({ fullName: 'X' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('shopName');
  });

  it('rejects an application without accepted terms', async () => {
    const res = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload({ termsAccepted: false }));

    expect(res.status).toBe(422);
  });

  it('rejects a second pending application', async () => {
    await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload());

    const res = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload({ shopName: 'Another Shop' }));

    expect(res.status).toBe(409);
  });
});

describe('GET /api/sellers/applications', () => {
  it('lists applications newest first with a status filter', async () => {
    const res = await request(app)
      .get('/api/sellers/applications')
      .set('X-Dev-User', ADMIN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const pending = await request(app)
      .get('/api/sellers/applications?status=pending')
      .set('X-Dev-User', ADMIN);
    expect(pending.status).toBe(200);
    expect(pending.body.data.every((a) => a.status === 'pending')).toBe(true);
  });
});

describe('PATCH /api/sellers/applications/:id', () => {
  it('approves an application, creates a seller and promotes the role', async () => {
    const created = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload());
    const applicationId = created.body.data.id;

    const res = await request(app)
      .patch(`/api/sellers/applications/${applicationId}`)
      .set('X-Dev-User', ADMIN)
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('approved');
    expect(res.body.data.seller.shopName).toBe('Chidi Ceramics');

    // Role promoted + notification delivered to the applicant.
    const profile = store.getProfileRow(CUSTOMER);
    expect(profile.role).toBe('seller');
    const notifications = store.listNotifications(CUSTOMER);
    expect(notifications.some((n) => n.type === 'application_approved')).toBe(true);
  });

  it('rejects an application with review notes', async () => {
    const created = await request(app)
      .post('/api/sellers/applications')
      .set('X-Dev-User', CUSTOMER)
      .send(applicationPayload());
    const applicationId = created.body.data.id;

    const res = await request(app)
      .patch(`/api/sellers/applications/${applicationId}`)
      .set('X-Dev-User', ADMIN)
      .send({ decision: 'rejected', reviewNotes: 'Incomplete documents.' });

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('rejected');
    expect(res.body.data.application.reviewNotes).toBe('Incomplete documents.');
  });

  it('rejects a decision on an already-reviewed application', async () => {
    const res = await request(app)
      .patch('/api/sellers/applications/seed-app-approved')
      .set('X-Dev-User', ADMIN)
      .send({ decision: 'approved' });
    expect(res.status).toBe(409);
  });

  it('validates the decision value', async () => {
    const res = await request(app)
      .patch('/api/sellers/applications/seed-app-pending')
      .set('X-Dev-User', ADMIN)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/sellers', () => {
  it('lists sellers with product counts', async () => {
    const res = await request(app).get('/api/sellers').set('X-Dev-User', ADMIN);
    expect(res.status).toBe(200);
    const demo = res.body.data.find((s) => s.id === 'seed-seller-1');
    expect(demo).toBeDefined();
    expect(demo.products).toBeGreaterThan(0);
  });
});

describe('PATCH /api/sellers/:id', () => {
  it('blocks and unblocks a seller with notifications', async () => {
    const blocked = await request(app)
      .patch('/api/sellers/seed-seller-1')
      .set('X-Dev-User', ADMIN)
      .send({ status: 'blocked', reason: 'Policy breach' });
    expect(blocked.status).toBe(200);
    expect(blocked.body.data.status).toBe('blocked');
    expect(
      store.listNotifications(SELLER).some((n) => n.type === 'seller_blocked')
    ).toBe(true);

    const unblocked = await request(app)
      .patch('/api/sellers/seed-seller-1')
      .set('X-Dev-User', ADMIN)
      .send({ status: 'active' });
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.data.status).toBe('active');
  });

  it('404s for an unknown seller', async () => {
    const res = await request(app)
      .patch('/api/sellers/does-not-exist')
      .set('X-Dev-User', ADMIN)
      .send({ status: 'blocked' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/sellers/me', () => {
  it('returns seller context for an approved seller', async () => {
    const res = await request(app).get('/api/sellers/me').set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.isSeller).toBe(true);
    expect(res.body.data.seller.id).toBe('seed-seller-1');
  });

  it('returns the application for a pending applicant', async () => {
    const res = await request(app)
      .get('/api/sellers/me')
      .set('X-Dev-User', 'seed-user-amara');
    expect(res.status).toBe(200);
    expect(res.body.data.isSeller).toBe(false);
    expect(res.body.data.application.status).toBe('pending');
  });
});

describe('GET /api/sellers/me/dashboard', () => {
  it('returns stats, reviews, returns and notifications', async () => {
    const res = await request(app)
      .get('/api/sellers/me/dashboard')
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.seller.id).toBe('seed-seller-1');
    expect(res.body.data.stats.products).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.reviews)).toBe(true);
    expect(Array.isArray(res.body.data.returns)).toBe(true);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });
});
