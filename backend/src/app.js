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
 * Static serving roots, checked in order (first match wins).
 *
 * During the Vite/React migration (see frontend_react_migration_plan.md):
 *   1. `legacy/`    — the pre-migration static site stays authoritative for
 *                     every URL until its file is pruned after porting (so a
 *                     mid-migration `npm run build` never shadows e.g. the
 *                     real home page with the SPA shell).
 *   2. `dist/`      — the built SPA; takes over each route as legacy shrinks
 *                     and is the only root left once `legacy/` is deleted.
 *   3. the root     — fallback for layouts that keep pages at the app root.
 *
 * When neither `dist/` nor `legacy/` exists (e.g. FRONTEND_DIR overrides),
 * the root itself is served as before.
 */
const distDir = path.join(frontendRoot, 'dist');
const legacyDir = path.join(frontendRoot, 'legacy');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));
const hasLegacy = fs.existsSync(legacyDir);

export const staticRoots = hasLegacy
  ? [legacyDir, ...(hasDist ? [distDir] : [])]
  : hasDist
    ? [distDir]
    : [frontendRoot];

/** Primary static directory (what tests and docs point at). */
export const frontendDir = staticRoots[0];

/**
 * Client-side routes that should receive the SPA shell. Kept as an explicit
 * manifest so unknown paths (e.g. `/totally-missing`) and missing assets
 * still fall through to the 404 envelope.
 */
const SPA_ROUTES = [
  /^\/$/,
  /^\/(index|cart|checkout|product-details|order-succes|order-success|auth|seller-apply|seller-dashboard|admin|policies)(\.html)?$/,
  /^\/(products|product-details)\/[^/]+$/,
  /^\/order-success\/[^/]+$/
];
const isSpaRoute = (p) => SPA_ROUTES.some((re) => re.test(p));

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
  app.use('/api/consultations', consultationsRouter);
  app.use('/api/newsletter', newsletterRouter);

  // Serve the storefront from the same origin (removes CORS friction).
  // Built SPA first, then the legacy static site (migration), then the root.
  for (const root of staticRoots) {
    app.use(express.static(root, { extensions: ['html'] }));
  }

  // SPA fallback: hand client-side routes the React shell when it has been
  // built. Gated on the route manifest so unknown paths stay 404s.
  if (hasDist) {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      if (isSpaRoute(req.path)) return res.sendFile(path.join(distDir, 'index.html'));
      next();
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
