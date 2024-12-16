import { expect, test } from 'vitest'
import { accounts } from '~test/src/zksync.js'
import { createWalletClient } from '~viem/clients/createWalletClient.js'
import { http } from '~viem/clients/transports/http.js'
import {
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/chains.js'
import { walletActionsL1 } from '~viem/zksync/decorators/walletL1.js'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'

const walletClient = createWalletClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
  account: privateKeyToAccount(accounts[0].privateKey),
}).extend(walletActionsL1())

const clientL2 = createWalletClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
  account: privateKeyToAccount(accounts[0].privateKey),
})

test('requestExecute', async () => {
  expect(
    await walletClient.requestExecute({
      account: privateKeyToAccount(accounts[0].privateKey),
      client: clientL2,
      contractAddress: '0x00000',
      calldata: '0x0000',
    }),
  ).toBeDefined()
})
