import { expect, test } from 'vitest'
import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import { mockRequestReturnData, zksyncAccounts } from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createPublicClient,
  createWalletClient,
} from '~viem/index.js'
import {
  publicActionsL2,
  walletActionsL1,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/index.js'

const baseClient = anvilMainnet.getClient({
  batch: { multicall: false },
  account: true,
})
baseClient.request = (async ({ method, params }) => {
  if (method === 'eth_sendTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_estimateGas') return 158774n
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_getTransactionCount') return 1n
  if (method === 'eth_getBlockByNumber') return anvilMainnet.forkBlockNumber
  if (method === 'eth_chainId') return anvilMainnet.chain.id
  return anvilMainnet.getClient().request({ method, params } as any)
}) as EIP1193RequestFn
const client = baseClient.extend(walletActionsL1())

const baseZksyncClient = anvilZksync.getClient()
baseZksyncClient.request = (async ({ method, params }) => {
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_estimateGas') return 158774n
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn
const zksyncClient = baseZksyncClient.extend(publicActionsL2())

test('requestExecute', async () => {
  expect(
    await client.requestExecute({
      client: zksyncClient,
      contractAddress: await zksyncClient.getBridgehubContractAddress(),
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
      gasPrice: 200_000_000_000n,
      gas: 500_000n,
    }),
  ).toBeDefined()
})

const hyperchainL1WalletClient = createWalletClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
}).extend(walletActionsL1())

const hyperchainClient = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActionsL2())

test('hyperchain: requestExecute', async () => {
  expect(
    await hyperchainL1WalletClient.requestExecute({
      client: hyperchainClient,
      contractAddress: await hyperchainClient.getBridgehubContractAddress(),
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
    }),
  ).toBeDefined()
})
