import { expect, test } from 'vitest'

import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import {
  daiL1,
  mockRequestReturnData,
  zksyncAccounts,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createClient,
  publicActions,
} from '~viem/index.js'
import { wait } from '~viem/utils/wait.js'
import {
  getL2TokenAddress,
  l2BaseTokenAddress,
  legacyEthAddress,
  publicActionsL2,
  withdraw,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/index.js'
import { finalizeWithdrawal } from './finalizeWithdrawal.js'
import { isWithdrawalFinalized } from './isWithdrawalFinalized.js'

const request = (async ({ method, params }) => {
  if (method === 'eth_sendTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_sendRawTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_estimateGas') return 158774n
  if (method === 'eth_call')
    return '0x0000000000000000000000000000000000000000000000000000000000000000'
  if (method === 'eth_getTransactionCount') return 1n
  if (method === 'eth_gasPrice') return 150_000_000n
  if (method === 'eth_getBlockByNumber') return anvilMainnet.forkBlockNumber
  if (method === 'eth_chainId') return anvilMainnet.chain.id
  return anvilMainnet.getClient().request({ method, params } as any)
}) as EIP1193RequestFn

const baseClient = anvilMainnet.getClient({ batch: { multicall: false } })
baseClient.request = request
const client = baseClient.extend(publicActions)

const baseClientWithAccount = anvilMainnet.getClient({
  batch: { multicall: false },
  account: true,
})
baseClientWithAccount.request = request
const clientWithAccount = baseClientWithAccount.extend(publicActions)

const baseClientL2 = anvilZksync.getClient()
baseClientL2.request = (async ({ method, params }) => {
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_estimateGas') return 158774n
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn
const clientL2 = baseClientL2.extend(publicActionsL2())

test('default', async () => {
  expect(
    await isWithdrawalFinalized(client, {
      client: clientL2,
      hash: '0x08ac22b6d5d048ae8a486aa41a058bb01d82bdca6489760414aa15f61f27b943',
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  expect(
    await finalizeWithdrawal(clientWithAccount, {
      client: clientL2,
      hash: '0x08ac22b6d5d048ae8a486aa41a058bb01d82bdca6489760414aa15f61f27b943',
    }),
  ).toBeDefined()
})

const hyperchainClient = createClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActions)

const customHyperchainClient = createClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActions)

const hyperchainL1Client = createClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
}).extend(publicActions)

const account = privateKeyToAccount(zksyncAccounts[0].privateKey)

test('ETH: not finalized withdrawal', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait for 5 seconds for tx to be in finalized state
  await wait(5_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).false
})

test('ETH: finalized withdrawal', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait for 20 seconds for batch to be submitted on L1
  await wait(20_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).false

  const finalizeHash = await finalizeWithdrawal(hyperchainL1Client, {
    account,
    client: hyperchainClient,
    hash,
  })
  const finalizeReceipt = await hyperchainL1Client.waitForTransactionReceipt({
    hash: finalizeHash,
  })
  expect(finalizeReceipt.status).equals('success')
  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).true
})

test('ETH: not finalized withdrawal using account hoisting', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait for 5 seconds for tx to be in finalized state
  await wait(5_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).false
})

test('ETH: not finalized DAI token withdrawal', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: daiL2,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait for 5 seconds for tx to be in finalized state
  await wait(5_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).false
})

test('ETH: finalized DAI token withdrawal', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: daiL2,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  // wait for 20 seconds for batch to be submitted on L1
  await wait(20_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).false

  const finalizeHash = await finalizeWithdrawal(hyperchainL1Client, {
    account,
    client: hyperchainClient,
    hash,
  })
  const finalizeReceipt = await hyperchainL1Client.waitForTransactionReceipt({
    hash: finalizeHash,
  })
  expect(finalizeReceipt.status).equals('success')
  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).true
})

test('ETH: log not found error', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: legacyEthAddress,
  })

  const receipt = await hyperchainClient.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  await expect(() =>
    isWithdrawalFinalized(hyperchainL1Client, {
      client: hyperchainClient,
      hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [WithdrawalLogNotFoundError: Withdrawal log with hash ${hash} not found.

    Either the withdrawal transaction is still processing or it did not finish successfully.

    Version: viem@x.y.z]
  `)
})

test('Custom: not finalized withdrawal', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash,
  })
  expect(receipt.status).equals('success')

  // wait for 5 seconds for tx to be in finalized state
  await wait(5_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: customHyperchainClient,
      hash,
    }),
  ).false
})

test('Custom: finalized withdrawal', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash,
  })
  expect(receipt.status).equals('success')

  // wait for 20 seconds for batch to be submitted on L1
  await wait(20_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: customHyperchainClient,
      hash,
    }),
  ).false

  const finalizeHash = await finalizeWithdrawal(hyperchainL1Client, {
    client: customHyperchainClient,
    account,
    hash,
  })
  const finalizeReceipt = await hyperchainL1Client.waitForTransactionReceipt({
    hash: finalizeHash,
  })
  expect(finalizeReceipt.status).equals('success')
  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: customHyperchainClient,
      hash,
    }),
  ).true
})

test('Custom: not finalized withdrawal using account hoisting', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash,
  })
  expect(receipt.status).equals('success')

  // wait for 5 seconds for tx to be in finalized state
  await wait(5_000)

  expect(
    await isWithdrawalFinalized(hyperchainL1Client, {
      client: customHyperchainClient,
      hash,
    }),
  ).false
})

test('Custom: log not found error', async () => {
  const amount = 7_000_000_000n

  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash,
  })
  expect(receipt.status).equals('success')
  await expect(() =>
    isWithdrawalFinalized(hyperchainL1Client, {
      client: customHyperchainClient,
      hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [WithdrawalLogNotFoundError: Withdrawal log with hash ${hash} not found.

    Either the withdrawal transaction is still processing or it did not finish successfully.

    Version: viem@x.y.z]
  `)
})
