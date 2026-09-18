import { beforeEach } from 'vitest';
import { store } from '../src/store.js';

// Ensure every test starts from a clean, deterministic state.
beforeEach(() => {
  store.reset();
});
