import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.tests.ts', '**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // The documented bar (AGENTS.md) is ≥ 75% lines; actual sits well above.
      // Thresholds guard the promise, not the high-water mark.
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
})
