import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// https://github.com/testing-library/jest-dom/issues/567#issuecomment-2049619661
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface JestAssertion<T = any> extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, T> {}
}

// https://testing-library.com/docs/react-testing-library/api/#cleanup
afterEach(cleanup)
