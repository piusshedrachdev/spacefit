import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';

const app = createApp();

const ADMIN = 'dev-user-admin';
const SELLER = 'dev-user-seller';
const CUSTOMER = 'dev-user-customer';

/** The seeded seller row owned by dev-user-seller. */
const OWNED = 'seed-seller-1';

/** Seed a return directly (same style as notifications.test.js fixtures). */
function seedReturn(sellerId, overrides = {}) {
  return store.createReturn({
    orderId: 'seed-demo-order',
    productId: 'luna-bed',
    sellerId,
    requestedBy: CUSTOMER,
    reason: 'Item arrived damaged.',
    ...overrides
  });
}

function blockSeededSeller() {
  store.updateSeller(OWNED, { status: 'blocked' });
}

/** Promote dev-user-customer to a second approved seller via the API. */
async function makeSecondSeller() {
  const applied = await request(app)
    .post('/api/sellers/applications')
    .set('X-Dev-User', CUSTOMER)
    .send({
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
      disclaimersAccepted: true
    });
  const appId = applied.body.data.id;
  await request(app)
    .patch(`/api/sellers/applications/${appId}`)
    .set('X-Dev-User', ADMIN)
    .send({ decision: 'approved' });
}

describe('GET /api/returns', () => {
  it('lets an admin see returns across every seller', async () => {
    seedReturn('other-seller-9');

    const res = await request(app).get('/api/returns').set('X-Dev-User', ADMIN);

    expect(res.status).toBe(200);
    const sellerIds = res.body.data.map((r) => r.sellerId);
    expect(sellerIds).toContain(OWNED); // the seeded shop's returns
    expect(sellerIds).toContain('other-seller-9'); // not filtered away
    expect(res.body.meta.count).toBe(res.body.data.length);
  });

  it('limits a seller to their own shop', async () => {
    seedReturn('other-seller-9');

    const res = await request(app).get('/api/returns').set('X-Dev-User', SELLER);

    expect(res.status).toBe(200);
    // The two seeded demo returns belong to seed-seller-1.
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((r) => r.sellerId === OWNED)).toBe(true);
  });

  it('rejects a customer without a shop', async () => {
    const res = await request(app).get('/api/returns').set('X-Dev-User', CUSTOMER);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });

  it('rejects a caller with no identity', async () => {
    const res = await request(app).get('/api/returns');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });

  it('blocks a seller whose account is blocked', async () => {
    blockSeededSeller();

    const res = await request(app).get('/api/returns').set('X-Dev-User', SELLER);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Seller account is blocked');
  });

  it('lets an admin past the blocked-seller gate', async () => {
    blockSeededSeller();

    const res = await request(app).get('/api/returns').set('X-Dev-User', ADMIN);

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/returns/:id', () => {
  it('lets the owning seller update their return', async () => {
    const record = seedReturn(OWNED);

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set('X-Dev-User', SELLER)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  it('lets an admin update any return', async () => {
    const record = seedReturn('other-seller-9');

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set('X-Dev-User', ADMIN)
      .send({ status: 'rejected', resolutionNotes: 'Outside the window.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.resolutionNotes).toBe('Outside the window.');
  });

  it('does not let another seller update a return', async () => {
    await makeSecondSeller();
    const record = seedReturn(OWNED);

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set('X-Dev-User', CUSTOMER) // now a seller — but not the owner
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('You can only manage returns for your own products');
  });

  it('rejects a customer without a shop', async () => {
    const record = seedReturn(OWNED);

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set('X-Dev-User', CUSTOMER)
      .send({ status: 'approved' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });

  it('blocks a blocked seller from updating returns', async () => {
    blockSeededSeller();
    const record = seedReturn(OWNED);

    const res = await request(app)
      .patch(`/api/returns/${record.id}`)
      .set('X-Dev-User', SELLER)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Seller account is blocked');
  });

  it('404s an unknown return for an authorised caller', async () => {
    const res = await request(app)
      .patch('/api/returns/does-not-exist')
      .set('X-Dev-User', ADMIN)
      .send({ status: 'approved' });

    expect(res.status).toBe(404);
  });

  it('answers 401 — not 404 — when an unauthorised caller probes an unknown id', async () => {
    // Authorisation runs before the lookup so the response never reveals
    // whether the return exists.
    const res = await request(app)
      .patch('/api/returns/does-not-exist')
      .set('X-Dev-User', CUSTOMER)
      .send({ status: 'approved' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Seller access required');
  });
});

describe('POST /api/returns', () => {
  it('raises a return against the product seller', async () => {
    const product = store.listProducts({ sellerId: OWNED }).items[0];

    const res = await request(app)
      .post('/api/returns')
      .set('X-Dev-User', CUSTOMER)
      .send({ orderId: 'seed-demo-order', productId: product.id, reason: 'Damaged in transit' });

    expect(res.status).toBe(201);
    expect(res.body.data.productId).toBe(product.id);
    expect(res.body.data.sellerId).toBe(OWNED);
    expect(res.body.data.status).toBe('requested');
  });

  it('404s an unknown product', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set('X-Dev-User', CUSTOMER)
      .send({ orderId: 'seed-demo-order', productId: 'no-such-product', reason: 'Damaged in transit' });

    expect(res.status).toBe(404);
  });

  it('rejects a reason that is too short', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set('X-Dev-User', CUSTOMER)
      .send({ orderId: 'seed-demo-order', productId: 'luna-bed', reason: 'xy' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('reason');
  });
});
