import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@contracts': path.resolve(__dirname, '../../shared-contracts'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx,js,mjs}'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
