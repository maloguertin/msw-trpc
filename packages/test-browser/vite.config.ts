import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      provider: 'playwright',
      enabled: true,
      instances: [
        {
          mockReset: true,
          clearMocks: true,
          browser: 'chromium',
        },
      ],
    },
  },
})
