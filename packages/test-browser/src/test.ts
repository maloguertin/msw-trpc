import { test as testBase } from 'vitest'
import { setupWorker } from 'msw/browser'
import type { SetupWorker } from 'msw/browser'

const worker = setupWorker()

export const test = testBase.extend<{ worker: SetupWorker }>({
  worker: [
    async ({}, use) => {
      await worker.start({ onUnhandledRequest: 'error' })
      await use(worker)
      worker.stop()
    },
    {
      auto: true,
    },
  ],
})
