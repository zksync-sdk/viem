import { beforeAll, expect, test } from 'vitest'

import {
  accounts,
  approvalToken,
  daiL1,
  getTokenBalance,
  paymaster,
  setupCustomHyperchain,
  setupHyperchain,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'
import { http, createClient, publicActions } from '../../index.js'
import {
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
} from '../chains.js'
import {
  ethAddressInContracts,
  l2BaseTokenAddress,
  legacyEthAddress,
} from '../constants/address.js'
import { getApprovalBasedPaymasterInput } from '../utils/paymaster/getApprovalBasedPaymasterInput.js'
import { getL2TokenAddress } from './getL2TokenAddress.js'
import { withdraw } from './withdraw.js'

const client = createClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActions)

const customChainClient = createClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActions)

const account = privateKeyToAccount(accounts[0].privateKey)

beforeAll(async () => {
  await setupHyperchain()
  await setupCustomHyperchain()
})

test('ETH: withdraw base token', async () => {
  const amount = 7_000_000_000n
  const balanceBeforeWithdrawal = await client.getBalance({
    address: account.address,
  })
  const hash = await withdraw(client, {
    account,
    amount,
    token: legacyEthAddress,
  })
  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await client.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw base token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal = await client.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(client, {
    account,
    amount,
    token: legacyEthAddress,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: minimalAllowance,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })
  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await client.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw DAI token', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(client, { token: daiL1 })
  const balanceBeforeWithdrawal = await getTokenBalance(
    client,
    daiL2,
    account.address,
  )
  const hash = await withdraw(client, {
    account,
    amount,
    token: daiL2,
  })
  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await getTokenBalance(
    client,
    daiL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('ETH: withdraw DAI token using paymaster', async () => {
  const amount = 5n
  const minimalAllowance = 1n
  const daiL2 = await getL2TokenAddress(client, { token: daiL1 })

  const balanceBeforeWithdrawal = await getTokenBalance(
    client,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(client, {
    account,
    amount,
    token: daiL2,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: 1n,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })

  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await getTokenBalance(
    client,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw base token with account hoisting', async () => {
  const amount = 7_000_000_000n
  const client = createClient({
    account: privateKeyToAccount(accounts[0].privateKey),
    chain: zksyncLocalHyperchain,
    transport: http(),
  }).extend(publicActions)

  const balanceBeforeWithdrawal = await client.getBalance({
    address: account.address,
  })
  const hash = await withdraw(client, {
    amount,
    token: legacyEthAddress,
  })
  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await client.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw base token using paymaster and account hoisting', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n
  const client = createClient({
    account: privateKeyToAccount(accounts[0].privateKey),
    chain: zksyncLocalHyperchain,
    transport: http(),
  }).extend(publicActions)

  const balanceBeforeWithdrawal = await client.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(client, {
    account,
    amount,
    token: legacyEthAddress,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: minimalAllowance,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })
  const receipt = await client.waitForTransactionReceipt({ hash: hash })
  const balanceAfterWithdrawal = await client.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await client.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    client,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw ETH token', async () => {
  const amount = 7_000_000_000n
  const ethL2 = await getL2TokenAddress(customChainClient, {
    token: ethAddressInContracts,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    ethL2,
    account.address,
  )
  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: ethL2,
  })
  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    ethL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('Custom: withdraw ETH token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n
  const ethL2 = await getL2TokenAddress(customChainClient, {
    token: ethAddressInContracts,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    ethL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: ethL2,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: 1n,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })

  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    ethL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token', async () => {
  const amount = 7_000_000_000n
  const balanceBeforeWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })
  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: 1n,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })

  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw DAI token', async () => {
  const amount = 5n
  const daiL2 = await getL2TokenAddress(customChainClient, { token: daiL1 })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    daiL2,
    account.address,
  )
  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: daiL2,
  })
  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    daiL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('Custom: withdraw DAI token using paymaster', async () => {
  const amount = 5n
  const minimalAllowance = 1n
  const daiL2 = await getL2TokenAddress(customChainClient, { token: daiL1 })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: daiL2,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: 1n,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })

  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token with account hoisting', async () => {
  const amount = 7_000_000_000n
  const customChainClient = createClient({
    account: privateKeyToAccount(accounts[0].privateKey),
    chain: zksyncLocalCustomHyperchain,
    transport: http(),
  }).extend(publicActions)

  const balanceBeforeWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const hash = await withdraw(customChainClient, {
    amount,
    token: l2BaseTokenAddress,
  })
  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token using paymaster and account hoisting', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n
  const customChainClient = createClient({
    account: privateKeyToAccount(accounts[0].privateKey),
    chain: zksyncLocalCustomHyperchain,
    transport: http(),
  }).extend(publicActions)

  const balanceBeforeWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customChainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
    paymaster: paymaster,
    paymasterInput: getApprovalBasedPaymasterInput({
      minAllowance: 1n,
      token: approvalToken,
      innerInput: new Uint8Array(),
    }),
  })

  const receipt = await customChainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customChainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await customChainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customChainClient,
    approvalToken,
    paymaster,
  )

  expect(receipt.status).equals('success')
  expect(
    paymasterBalanceBeforeWithdrawal - paymasterBalanceAfterWithdrawal >= 0n,
  ).true
  expect(
    paymasterTokenBalanceAfterWithdrawal -
      paymasterTokenBalanceBeforeWithdrawal,
  ).equal(minimalAllowance)
  expect(
    approvalTokenBalanceAfterWithdrawal ===
      approvalTokenBalanceBeforeWithdrawal - minimalAllowance,
  ).true
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})
