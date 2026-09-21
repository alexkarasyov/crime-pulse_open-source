// Vitest config — unit tests for src/lib plus built-aggregate invariant
// checks under tests/. Pure node environment: the lib modules under test are
// browser-agnostic (window access is feature-guarded), so no DOM shim is
// needed; tests that exercise persistence stub a minimal `window` themselves.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
