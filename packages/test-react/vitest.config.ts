import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/setup.ts'],
    include: ['./**/*.test.tsx'],
    environment: 'jsdom',
  },
})
