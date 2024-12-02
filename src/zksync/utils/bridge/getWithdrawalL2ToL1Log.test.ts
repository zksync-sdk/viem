import { expect, test } from 'vitest'
import { anvilZksync } from '~test/src/anvil.js'
import { accounts, mockRequestReturnData } from '~test/src/zksync.js'
import type { EIP1193RequestFn } from '~viem/types/eip1193.js'
import { wait } from '~viem/utils/wait.js'
import { zksyncLocalHyperchain } from '~viem/zksync/chains.js'
import { privateKeyToAccount } from '../../../accounts/privateKeyToAccount.js'
import { createClient } from '../../../clients/createClient.js'
import { publicActions } from '../../../clients/decorators/public.js'
import { http } from '../../../clients/transports/http.js'
import { withdraw } from '../../actions/withdraw.js'
import { legacyEthAddress } from '../../constants/address.js'
import { getWithdrawalL2ToL1Log } from './getWithdrawalL2ToL1Log.js'

const client = anvilZksync.getClient({ batch: { multicall: false } })
client.request = (async ({ method, params }) => {
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn

test('default', async () => {
  expect(
    await getWithdrawalL2ToL1Log(client, {
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
    account: privateKeyToAccount(accounts[0].privateKey),
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait  for 20 seconds for tx to be in finalized state
  await wait(20_000)
  expect(await getWithdrawalL2ToL1Log(hyperchainClient, { hash })).toBeDefined()
})
