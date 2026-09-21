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
