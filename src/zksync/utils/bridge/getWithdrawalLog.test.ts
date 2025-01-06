import { expect, test } from 'vitest'
import { anvilZksync } from '~test/src/anvil.js'
import { mockRequestReturnData, zksyncAccounts } from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createClient,
  publicActions,
} from '~viem/index.js'
import { wait } from '~viem/utils/wait.js'
import {
  legacyEthAddress,
  withdraw,
  zksyncLocalHyperchain,
} from '~viem/zksync/index.js'
import { getWithdrawalLog } from './getWithdrawalLog.js'

const client = anvilZksync.getClient({ batch: { multicall: false } })
client.request = (async ({ method, params }) => {
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn

test('default', async () => {
  expect(
    await getWithdrawalLog(client, {
      hash: '0x15c295874fe9ad8f6708def4208119c68999f7a76ac6447c111e658ba6bfaa1e',
    }),
  ).toBeDefined()
})

const hyperchainClient = createClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActions)

test('hyperchain', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(hyperchainClient, {
    account: privateKeyToAccount(zksyncAccounts[0].privateKey),
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait  for 20 seconds for tx to be in finalized state
  await wait(20_000)
  expect(await getWithdrawalLog(hyperchainClient, { hash })).toBeDefined()
})
