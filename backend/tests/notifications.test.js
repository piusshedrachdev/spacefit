import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';

const app = createApp();

const ADMIN = 'dev-user-admin';
const SELLER = 'dev-user-seller';

function seedNotification(userId, title) {
  return store.createNotification({
    userId,
    type: 'application_received',
    title,
    body: 'Test notification',
    link: 'admin.html'
  });
}

describe('GET /api/notifications', () => {
  it('returns only the caller notifications plus unreadCount', async () => {
    seedNotification(ADMIN, 'Admin only');
    seedNotification(SELLER, 'Seller only');

    const res = await request(app).get('/api/notifications').set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((n) => n.userId === SELLER)).toBe(true);
    expect(res.body.data.items.some((n) => n.title === 'Admin only')).toBe(false);
    expect(typeof res.body.data.unreadCount).toBe('number');
  });

  it('honours the limit query', async () => {
    const res = await request(app)
      .get('/api/notifications?limit=1')
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(1);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks one notification read', async () => {
    const notification = seedNotification(SELLER, 'Read me');
    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.readAt).not.toBeNull();
  });

  it('does not let another user read a notification', async () => {
    const notification = seedNotification(SELLER, 'Private');
    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('X-Dev-User', ADMIN);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/notifications/read-all', () => {
  it('marks every notification for the caller as read', async () => {
    seedNotification(SELLER, 'A');
    seedNotification(SELLER, 'B');

    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('X-Dev-User', SELLER);
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBeGreaterThanOrEqual(2);

    const list = await request(app).get('/api/notifications').set('X-Dev-User', SELLER);
    expect(list.body.data.unreadCount).toBe(0);
  });
});
