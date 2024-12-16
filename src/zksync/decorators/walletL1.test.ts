import { expect, test } from 'vitest'
import { accounts } from '~test/src/zksync.js'
import { createPublicClient } from '~viem/clients/createPublicClient.js'
import { createWalletClient } from '~viem/clients/createWalletClient.js'
import { http } from '~viem/clients/transports/http.js'
import {
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/chains.js'
import { publicActionsL2, walletActionsL1 } from '~viem/zksync/index.js'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'

const walletClient = createWalletClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
  account: privateKeyToAccount(accounts[0].privateKey),
}).extend(walletActionsL1())

const clientL2 = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActionsL2())

test('requestExecute', async () => {
  expect(
    await walletClient.requestExecute({
      client: clientL2,
      contractAddress: await clientL2.getBridgehubContractAddress(),
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
    }),
  ).toBeDefined()
})
