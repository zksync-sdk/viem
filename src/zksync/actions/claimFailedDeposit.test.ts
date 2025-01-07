import { expect, test } from 'vitest'
import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import { accounts } from '~test/src/constants.js'
import { mockRequestReturnData, zksyncAccounts } from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createPublicClient,
  publicActions,
} from '~viem/index.js'
import { getBaseTokenL1Address } from '~viem/zksync/actions/getBaseTokenL1Address.js'
import {
  deposit,
  getL2HashFromPriorityOp,
  legacyEthAddress,
  publicActionsL2,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/index.js'
import { claimFailedDeposit } from './claimFailedDeposit.js'

const request = (async ({ method, params }) => {
  if (method === 'eth_sendRawTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_sendTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_estimateGas') return 158774n
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
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
    await claimFailedDeposit(client, {
      account: privateKeyToAccount(accounts[0].privateKey),
      client: clientL2,
      hash: '0x08ac22b6d5d048ae8a486aa41a058bb01d82bdca6489760414aa15f61f27b943',
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  expect(
    await claimFailedDeposit(clientWithAccount, {
      client: clientL2,
      hash: '0x08ac22b6d5d048ae8a486aa41a058bb01d82bdca6489760414aa15f61f27b943',
    }),
  ).toBeDefined()
})

const hyperchainClient = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const hyperchainCustomClient = createPublicClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const hyperchainL1Client = createPublicClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
})

const account = privateKeyToAccount(zksyncAccounts[0].privateKey)

test('ETH: cannot claim successful deposit', async () => {
  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    token: legacyEthAddress,
    to: account.address,
    amount: 7_000_000_000n,
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainClient.getMainContractAddress(),
  )
  expect(l2Hash).toBeDefined()
  const l2Receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  await expect(() =>
    claimFailedDeposit(hyperchainL1Client, {
      account,
      client: hyperchainClient,
      hash: l2Hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [CannotClaimSuccessfulDepositError: Cannot claim successful deposit.

    Version: viem@x.y.z]
  `)
})

test('Custom: cannot claim successful deposit', async () => {
  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: await getBaseTokenL1Address(hyperchainCustomClient),
    to: account.address,
    amount: 5n,
    approveToken: true,
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  expect(l2Hash).toBeDefined()
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  await expect(() =>
    claimFailedDeposit(hyperchainL1Client, {
      account,
      client: hyperchainCustomClient,
      hash: l2Hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [CannotClaimSuccessfulDepositError: Cannot claim successful deposit.

    Version: viem@x.y.z]
  `)
})
