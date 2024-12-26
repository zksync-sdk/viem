import { beforeAll, expect, test } from 'vitest'
import {
  accounts,
  daiL1,
  getTokenBalance,
  setupCustomHyperchain,
  setupHyperchain,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { createPublicClient } from '~viem/clients/createPublicClient.js'
import { http } from '~viem/clients/transports/http.js'
import { getBaseTokenL1Address } from '~viem/zksync/actions/getBaseTokenL1Address.js'
import { getL1Balance } from '~viem/zksync/actions/getL1Balance.js'
import { getL2TokenAddress } from '~viem/zksync/actions/getL2TokenAddress.js'
import {
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/chains.js'
import {
  ethAddressInContracts,
  legacyEthAddress,
} from '~viem/zksync/constants/address.js'
import { publicActionsL2 } from '~viem/zksync/decorators/publicL2.js'
import { getL2HashFromPriorityOp } from '~viem/zksync/utils/bridge/getL2HashFromPriorityOp.js'
import { deposit } from './deposit.js'

const client = createPublicClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
})

const clientL2 = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const clientL2Custom = createPublicClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const account = privateKeyToAccount(accounts[0].privateKey)

beforeAll(async () => {
  await setupHyperchain()
  await setupCustomHyperchain()
})

test('ETH: deposit ETH to L2 network', async () => {
  const amount = 7_000_000_000n
  const l1BalanceBeforeDeposit = await client.getBalance(account)
  const l2BalanceBeforeDeposit = await clientL2.getBalance(account)

  const hash = await deposit(client, {
    client: clientL2,
    account,
    token: legacyEthAddress,
    to: account.address,
    amount,
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2.getMainContractAddress(),
  )
  expect(l2Hash).toBeDefined()
  const l2Receipt = await clientL2.waitForTransactionReceipt({ hash: l2Hash })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await client.getBalance(account)
  const l2BalanceAfterDeposit = await clientL2.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('ETH: deposit DAI to L2 network', async () => {
  const amount = 7n
  const daiL2 = await getL2TokenAddress(clientL2, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2,
    daiL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2,
    account,
    token: daiL1,
    to: account.address,
    amount,
    approveToken: true,
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2.getMainContractAddress(),
  )
  expect(l2Hash).toBeDefined()
  const l2Receipt = await clientL2.waitForTransactionReceipt({ hash: l2Hash })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('ETH: deposit DAI to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(clientL2, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2,
    daiL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2,
    account,
    token: daiL1,
    to: account.address,
    amount,
    approveToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')

  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2.getMainContractAddress(),
  )
  expect(l2Hash).toBeDefined()
  const l2Receipt = await clientL2.waitForTransactionReceipt({ hash: l2Hash })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit ETH token to L2 network', async () => {
  const amount = 7_000_000_000n
  const ethL2 = await getL2TokenAddress(clientL2Custom, {
    token: ethAddressInContracts,
  })
  const l1BalanceBeforeDeposit = await client.getBalance(account)
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2Custom,
    ethL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2Custom,
    account,
    token: legacyEthAddress,
    amount,
    approveBaseToken: true,
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await client.getBalance(account)
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2Custom,
    ethL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit ETH token to L2 network with overrides for approve token transaction', async () => {
  const amount = 7_000_000_000n
  const ethL2 = await getL2TokenAddress(clientL2Custom, {
    token: ethAddressInContracts,
  })
  const l1BalanceBeforeDeposit = await client.getBalance(account)
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2Custom,
    ethL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2Custom,
    account,
    token: legacyEthAddress,
    amount,
    approveBaseToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await client.getBalance(account)
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2Custom,
    ethL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit base token to L2 network', async () => {
  const amount = 5n
  const baseTokenL1 = await getBaseTokenL1Address(clientL2Custom)
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceBeforeDeposit = await clientL2Custom.getBalance(account)

  const hash = await deposit(client, {
    client: clientL2Custom,
    account,
    token: baseTokenL1,
    amount,
    approveToken: true,
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceAfterDeposit = await clientL2Custom.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit base token to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const baseTokenL1 = await getBaseTokenL1Address(clientL2Custom)
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceBeforeDeposit = await clientL2Custom.getBalance(account)

  const hash = await deposit(client, {
    client: clientL2Custom,
    account,
    token: baseTokenL1,
    amount,
    approveToken: {
      maxFeePerGas: 200_000_000_000n,
    },
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: baseTokenL1,
    account,
  })
  const l2BalanceAfterDeposit = await clientL2Custom.getBalance(account)
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit DAI token to L2 network', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(clientL2Custom, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2Custom,
    daiL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2Custom,
    account,
    token: daiL1,
    amount,
    approveToken: true,
    approveBaseToken: true,
    refundRecipient: account.address,
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2Custom,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('Custom: deposit DAI token to L2 network with overrides for approve token transaction', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(clientL2Custom, { token: daiL1 })
  const l1BalanceBeforeDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceBeforeDeposit = await getTokenBalance(
    clientL2Custom,
    daiL2,
    account.address,
  )

  const hash = await deposit(client, {
    client: clientL2Custom,
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
  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await clientL2Custom.getMainContractAddress(),
  )
  const l2Receipt = await clientL2Custom.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterDeposit = await getL1Balance(client, {
    token: daiL1,
    account,
  })
  const l2BalanceAfterDeposit = await getTokenBalance(
    clientL2Custom,
    daiL2,
    account.address,
  )
  expect(l1BalanceBeforeDeposit - l1BalanceAfterDeposit >= amount).true
  expect(l2BalanceAfterDeposit - l2BalanceBeforeDeposit >= amount).true
})

test('errors: no account provided', async () => {
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
