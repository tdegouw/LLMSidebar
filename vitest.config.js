import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
    globals: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
