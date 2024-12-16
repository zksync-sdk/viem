import { test } from 'vitest'
import { setupCustomHyperchain, setupHyperchain } from '../src/zksync'

test('setup', async () => {
  await setupHyperchain()
  await setupCustomHyperchain()
})
