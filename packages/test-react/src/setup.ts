import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'

// https://github.com/testing-library/jest-dom?tab=readme-ov-file#with-vitest
expect.extend(matchers)

// https://testing-library.com/docs/react-testing-library/api/#cleanup
afterEach(cleanup)
