import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import ordersRouter from './routes/orders.js';
import consultationsRouter from './routes/consultations.js';
import newsletterRouter from './routes/newsletter.js';
import metaRouter from './routes/meta.js';

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

  // Lightweight request logger (only outside tests).
  if (config.nodeEnv !== 'test') {
    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.get('/', (_req, res) => {
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

  app.use('/api/meta', metaRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/consultations', consultationsRouter);
  app.use('/api/newsletter', newsletterRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
