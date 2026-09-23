import { createApp } from './app.js';
import { config } from './config.js';
import { isSupabaseConfigured } from './lib/supabase.js';

const app = createApp();

const server = app.listen(config.port);

server.on('listening', () => {
  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : config.port;
  console.log(`\n  SpaceFit API listening on http://localhost:${boundPort}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  CORS origin: ${config.corsOrigin}`);
  const keyLen = (config.supabase.secretKey || '').length;
  console.log(`  Supabase: ${isSupabaseConfigured ? `configured (secret key ${keyLen} chars)` : 'not configured \u2014 using in-memory store'}`);
  if (isSupabaseConfigured && config.supabase.secretKey === config.supabase.publishableKey) {
    console.warn('  \u26a0 SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY are the same value \u2014 RLS will NOT be bypassed. This is the usual cause of 42501 "row-level security" errors on server-side writes.');
  }
  console.log('');
});

/**
 * Handle bind-time errors (port in use, permission denied, etc.) with a clear,
 * actionable message instead of letting them bubble to `uncaughtException`.
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n  Port ${config.port} is already in use.\n` +
        `  Another instance may be running. To fix this you can:\n` +
        `    1. Stop the process using the port:\n` +
        `         Windows:  netstat -ano | findstr :${config.port}   then   taskkill /PID <pid> /F\n` +
        `         macOS/Linux:  lsof -i :${config.port}   then   kill <pid>\n` +
        `    2. Or run this server on a different port:\n` +
        `         Windows:  set PORT=4001 && npm run dev\n` +
        `         macOS/Linux:  PORT=4001 npm run dev\n`
    );
  } else if (err.code === 'EACCES') {
    console.error(
      `\n  Permission denied binding to port ${config.port}.\n` +
        `  Try a port above 1024 (e.g. PORT=4001) or run with elevated privileges.\n`
    );
  } else {
    console.error('\n  Failed to start HTTP server:', err);
  }

  process.exit(1);
});

/**
 * Graceful shutdown so in-flight requests finish before the process exits.
 */
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Force exit if connections hang for more than 10s.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  // `server.on('error')` already handles bind failures, so only unexpected
  // exceptions reach here.
  console.error('[uncaughtException]', err);
  shutdown('uncaughtException');
});
