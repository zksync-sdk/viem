import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '~contracts': join(__dirname, '../contracts'),
      '~viem': join(__dirname, '../src'),
      '~test': join(__dirname, '.'),
    },
    environment: 'node',
    hookTimeout: 500_000,
    testTimeout: 500_000,
  },
})
