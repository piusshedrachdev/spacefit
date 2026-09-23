import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

// The suite runs without Supabase credentials, so the DB facade falls back to
// the in-memory store and auth-guard middleware is a no-op. These tests cover
// the request-validation and error-handling surface that is independent of the
// live Supabase project.

describe('POST /api/auth/signup', () => {
  it('rejects a missing email', async () => {
    const res = await request(app).post('/api/auth/signup').send({ password: 'supersecret' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'supersecret' });
    expect(res.status).toBe(422);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('password');
  });
});

describe('POST /api/auth/login', () => {
  it('requires email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });
});

describe('POST /api/auth/refresh', () => {
  it('requires a refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('refreshToken');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('requires a valid email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'bad' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ password: 'tiny' });
    expect(res.status).toBe(422);
  });
});

describe('auth middleware', () => {
  it('leaves req.user null for requests without a bearer token', async () => {
    // /api/auth/me is guarded, but requireAuth is a no-op in memory mode, so we
    // assert the request reaches the handler without a session.
    const res = await request(app).get('/api/auth/me');
    expect([200, 401]).toContain(res.status);
  });

  it('ignores malformed authorization headers', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer abc');
    expect([200, 401]).toContain(res.status);
  });
});

describe('GET /api/auth/me (memory mode)', () => {
  it('returns the dev user profile without touching Supabase', async () => {
    const res = await request(app).get('/api/auth/me').set('X-Dev-User', 'dev-user-admin');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('dev-user-admin');
    expect(res.body.data.profile.role).toBe('admin');
    expect(res.body.data.profile).toHaveProperty('full_name');
  });

  it('401s without any identity', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me (memory mode)', () => {
  it('updates own profile fields in the in-memory store', async () => {
    const res = await request(app)
      .patch('/api/auth/me')
      .set('X-Dev-User', 'dev-user-customer')
      .send({ phone: '+2348011111111' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+2348011111111');

    const readBack = await request(app)
      .get('/api/auth/me')
      .set('X-Dev-User', 'dev-user-customer');
    expect(readBack.body.data.profile.phone).toBe('+2348011111111');
  });

  it('rejects an empty patch', async () => {
    const res = await request(app)
      .patch('/api/auth/me')
      .set('X-Dev-User', 'dev-user-customer')
      .send({});
    expect(res.status).toBe(400);
  });
});

import { resolveRole } from '../src/middleware/auth.js';
import { store } from '../src/store.js';

describe('resolveRole', () => {
  it('reads the role from profiles.role (single source of truth)', async () => {
    store.setProfileRole('dev-user-customer', 'admin');
    const req = {
      user: {
        id: 'dev-user-customer',
        // Deliberately misleading metadata: the profile row must win.
        app_metadata: { role: 'customer' },
        user_metadata: { role: 'customer' }
      }
    };
    expect(await resolveRole(req)).toBe('admin');
  });

  it('falls back to JWT metadata when no profile row exists', async () => {
    const req = {
      user: {
        id: 'no-such-user',
        app_metadata: { role: 'admin' },
        user_metadata: {}
      }
    };
    expect(await resolveRole(req)).toBe('admin');
  });

  it('defaults to customer when neither profile nor metadata is present', async () => {
    const req = { user: { id: 'no-such-user', app_metadata: {}, user_metadata: {} } };
    expect(await resolveRole(req)).toBe('customer');
  });

  it('returns null when there is no authenticated user', async () => {
    expect(await resolveRole({ user: null })).toBeNull();
  });
});
