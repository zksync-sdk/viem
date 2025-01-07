import { expect, test } from 'vitest'
import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import { accounts } from '~test/src/constants.js'
import {
  daiL1,
  getTokenBalance,
  mockRequestReturnData,
  zksyncAccounts,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createPublicClient,
  publicActions,
} from '~viem/index.js'
import { getBaseTokenL1Address } from '~viem/zksync/actions/getBaseTokenL1Address.js'
import { ethAddressInContracts } from '~viem/zksync/constants/address.js'
import {
  getL1Balance,
  getL2HashFromPriorityOp,
  getL2TokenAddress,
  legacyEthAddress,
  publicActionsL2,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/index.js'
import { deposit } from './deposit.js'

const request = (async ({ method, params }) => {
  if (method === 'eth_sendRawTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_sendTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_estimateGas') return 158774n
  if (method === 'eth_gasPrice') return 150_000_000n
  if (method === 'eth_maxPriorityFeePerGas') return 100_000_000n
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_getTransactionCount') return 1n
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
  const account = privateKeyToAccount(accounts[0].privateKey)
  expect(
    deposit(client, {
      client: clientL2,
      account,
      token: legacyEthAddress,
      to: account.address,
      amount: 7_000_000_000n,
      refundRecipient: account.address,
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  const account = privateKeyToAccount(accounts[0].privateKey)
  expect(
    deposit(clientWithAccount, {
      client: clientL2,
      token: legacyEthAddress,
      to: account.address,
      amount: 7_000_000_000n,
      refundRecipient: account.address,
    }),
  ).toBeDefined()
})

test('errors: no account provided', async () => {
  const account = privateKeyToAccount(accounts[0].privateKey)
  await expect(() =>
    deposit(client, {
      client: clientL2,
      token: legacyEthAddress,
      to: account.address,
      amount: 7_000_000_000n,
      refundRecipient: account.address,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [AccountNotFoundError: Could not find an Account to execute with this Action.
      Please provide an Account with the \`account\` argument on the Action, or by supplying an \`account\` to the Client.

      Docs: https://viem.sh/docs/actions/wallet/sendTransaction
      Version: viem@x.y.z]
  `)
})

const hyperchainL1Client = createPublicClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
})

const hyperchainClient = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const hyperchainCustomClient = createPublicClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const account = privateKeyToAccount(zksyncAccounts[0].privateKey)

test('ETH: deposit ETH to L2 network', async () => {
  const amount = 7_000_000_000n
  const l1BalanceBeforeDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceBeforeDeposit = await hyperchainClient.getBalance(account)

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    token: legacyEthAddress,
    to: account.address,
    amount,
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

  const l1BalanceAfterDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceAfterDeposit = await hyperchainClient.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('ETH: deposit DAI to L2 network', async () => {
  const amount = 7n
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    token: daiL1,
    to: account.address,
    amount,
    approveToken: true,
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

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('ETH: deposit DAI to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    token: daiL1,
    to: account.address,
    amount,
    approveToken: {
      maxFeePerGas: 200_000_000_000n,
    },
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

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit ETH token to L2 network', async () => {
  const amount = 7_000_000_000n
  const ethL2 = await getL2TokenAddress(hyperchainCustomClient, {
    token: ethAddressInContracts,
  })
  const l1BalanceBeforeDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainCustomClient,
    ethL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: legacyEthAddress,
    amount,
    approveBaseToken: true,
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainCustomClient,
    ethL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit ETH token to L2 network with overrides for approve token transaction', async () => {
  const amount = 7_000_000_000n
  const ethL2 = await getL2TokenAddress(hyperchainCustomClient, {
    token: ethAddressInContracts,
  })
  const l1BalanceBeforeDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainCustomClient,
    ethL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: legacyEthAddress,
    amount,
    approveBaseToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await hyperchainL1Client.getBalance(account)
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainCustomClient,
    ethL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit base token to L2 network', async () => {
  const amount = 5n
  const baseTokenL1 = await getBaseTokenL1Address(hyperchainCustomClient)
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceBeforeDeposit =
    await hyperchainCustomClient.getBalance(account)

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: baseTokenL1,
    amount,
    approveToken: true,
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceAfterDeposit = await hyperchainCustomClient.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit base token to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const baseTokenL1 = await getBaseTokenL1Address(hyperchainCustomClient)
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceBeforeDeposit =
    await hyperchainCustomClient.getBalance(account)

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: baseTokenL1,
    amount,
    approveToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceAfterDeposit = await hyperchainCustomClient.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit DAI token to L2 network', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(hyperchainCustomClient, {
    token: daiL1,
  })
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainCustomClient,
    daiL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: daiL1,
    amount,
    approveToken: true,
    approveBaseToken: true,
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainCustomClient,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit DAI token to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(hyperchainCustomClient, {
    token: daiL1,
  })
  const l1BalanceBeforeDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    hyperchainCustomClient,
    daiL2,
    account.address,
  )

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: daiL1,
    amount,
    approveToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    approveBaseToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainCustomClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(hyperchainL1Client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    hyperchainCustomClient,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('errors: no account provided', async () => {
  await expect(() =>
    deposit(hyperchainL1Client, {
      client: hyperchainClient,
      token: legacyEthAddress,
      to: account.address,
      amount: 7_000_000_000n,
      refundRecipient: account.address,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [AccountNotFoundError: Could not find an Account to execute with this Action.
      Please provide an Account with the \`account\` argument on the Action, or by supplying an \`account\` to the Client.

      Docs: https://viem.sh/docs/actions/wallet/sendTransaction
      Version: viem@x.y.z]
  `)
})
