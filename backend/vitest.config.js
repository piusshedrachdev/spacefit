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
      // Keep the existing seller-dashboard fixtures available to the test
      // suite while normal memory-mode seeding exposes only the reference
      // catalogue.
      SEED_DEMO_SELLER_LISTINGS: 'true',
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_PUBLISHABLE_KEY: '',
      SUPABASE_ANON_KEY: '',
      // Same reasoning: a developer's local .env may hold a real Brevo key;
      // tests must exercise the logged (skipped) path and never hit the API.
      BREVO_API_KEY: ''
    },
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js']
  }
});
