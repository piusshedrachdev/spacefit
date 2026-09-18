import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app.js';

/**
 * These tests verify the failure mode that caused the EADDRINUSE crash:
 * binding two servers to the same port must surface a clean 'error' event
 * carrying code EADDRINUSE (which server.js now handles explicitly).
 *
 * server.js itself is not imported here because it calls process.exit on
 * failure; instead we reproduce the bind conflict with two raw servers.
 */
const servers = [];

function listen(app, port = 0) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => {
      servers.push(server);
      resolve(server);
    });
    server.once('error', reject);
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise((resolve) => {
          if (s.listening) s.close(resolve);
          else resolve();
        })
    )
  );
});

describe('server bind handling', () => {
  it('emits EADDRINUSE when the port is already taken', async () => {
    const app = createApp();
    const first = await listen(app, 0);
    const { port } = first.address();

    const second = app.listen(port);
    const err = await new Promise((resolve) => second.once('error', resolve));

    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('EADDRINUSE');

    // The failed server must not be left listening.
    expect(second.listening).toBe(false);
  });

  it('can bind to an ephemeral port and serves requests', async () => {
    const app = createApp();
    const server = await listen(app, 0);
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('ok');
  });
});
