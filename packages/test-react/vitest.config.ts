import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['./src/**/*.test.{ts,tsx}'],
    setupFiles: './src/setup.ts',
    environment: 'happy-dom',
  },
})
