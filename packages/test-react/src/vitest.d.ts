import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'
import type { expect } from 'vitest'

// https://github.com/testing-library/jest-dom/issues/567#issuecomment-2049619661
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface JestAssertion<T = any> extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, T> {}
}
