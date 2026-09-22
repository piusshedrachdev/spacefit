import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Always test against the deterministic in-memory store, never the live
    // Supabase project, regardless of the local .env. These pre-set values win
    // because dotenv does not override existing env vars; blanking the
    // credentials also guarantees no test can reach the real database.
    env: {
      USE_SUPABASE: 'false',
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_PUBLISHABLE_KEY: '',
      SUPABASE_ANON_KEY: ''
    },
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js']
  }
});
