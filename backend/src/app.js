import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import ordersRouter from './routes/orders.js';
import consultationsRouter from './routes/consultations.js';
import newsletterRouter from './routes/newsletter.js';
import authRouter from './routes/auth.js';
import metaRouter from './routes/meta.js';
import sellersRouter from './routes/sellers.js';
import notificationsRouter from './routes/notifications.js';
import returnsRouter from './routes/returns.js';
import wishlistRouter from './routes/wishlist.js';
import { attachUser } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * App root of the static storefront. Defaults to the repo's `frontend/`
 * folder (two levels up from `backend/src`), overridable via FRONTEND_DIR
 * for deployment layouts.
 */
const frontendRoot = process.env.FRONTEND_DIR
  ? path.resolve(process.env.FRONTEND_DIR)
  : path.resolve(__dirname, '..', '..', 'frontend');

/**
 * Static serving root (the Vite migration is complete — frontend_react_
 * migration_plan.md Phase 7 deleted frontend/legacy/, so the built SPA is
 * authoritative for every client URL):
 *
 *   1. `dist/`    — the built SPA; real files first, then the SPA fallback
 *                   below hands client-side paths the shell.
 *   2. the root   — fallback for FRONTEND_DIR layouts that keep pages at
 *                   the app root (e.g. a pre-build checkout).
 */
const distDir = path.join(frontendRoot, 'dist');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

export const staticRoots = hasDist ? [distDir] : [frontendRoot];

/** Primary static directory (what tests and docs point at). */
export const frontendDir = staticRoots[0];

/**
 * Build the Express application.
 * Exported separately from the server bootstrap so tests can import it without
 * binding a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Resolve the caller's Supabase session (if any) for every request.
  app.use(attachUser);

  // Lightweight request logger (only outside tests).
  if (config.nodeEnv !== 'test') {
    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  // API metadata endpoint.
  app.get('/api', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'SpaceFit API',
        version: '1.0.0',
        docs: 'See /backend/README.md'
      }
    });
  });

  // Health is intentionally top-level so uptime probes can hit /api/health.
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }
    });
  });

  // API routers (registered before static assets so /api/* always wins).
  app.use('/api/meta', metaRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/sellers', sellersRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/consultations', consultationsRouter);
  app.use('/api/newsletter', newsletterRouter);

  // Serve the storefront from the same origin (removes CORS friction).
  for (const root of staticRoots) {
    app.use(express.static(root, { extensions: ['html'] }));
  }

  // SPA fallback (post-cutover): every non-API GET/HEAD that found no file
  // gets the built shell — the client router renders the page (`.html`
  // aliases like /policies.html land here too and redirect client-side) or
  // its 404 page. Unknown /api/* paths skip this and keep the JSON 404
  // envelope; missing assets (any other extension) also stay on it.
  if (hasDist) {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
