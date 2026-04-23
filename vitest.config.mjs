import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/server.js',
        'src/database/**',
        'src/public/**',
      ],
      thresholds: {
        statements: 70,
      },
    },
    // Single fork ensures in-memory SQLite is shared across all test files
    singleFork: true,
  },
});
