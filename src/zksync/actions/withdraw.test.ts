import { expect, test } from 'vitest'

import { anvilZksync } from '~test/src/anvil.js'
import { accounts } from '~test/src/constants.js'
import {
  approvalToken,
  daiL1,
  getTokenBalance,
  mockRequestReturnData,
  paymaster,
  zksyncAccounts,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import {
  http,
  type EIP1193RequestFn,
  createPublicClient,
  createWalletClient,
  publicActions,
} from '~viem/index.js'
import { ethAddressInContracts } from '~viem/zksync/constants/address.js'
import {
  getApprovalBasedPaymasterInput,
  getL2TokenAddress,
  l2BaseTokenAddress,
  legacyEthAddress,
  publicActionsL2,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
} from '~viem/zksync/index.js'
import { withdraw } from './withdraw.js'

const request = (async ({ method, params }) => {
  if (method === 'eth_sendRawTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_sendTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_estimateGas') return 158774n
  if (method === 'eth_getTransactionCount') return 1n
  if (method === 'eth_getBlockByNumber') return anvilZksync.forkBlockNumber
  if (method === 'eth_gasPrice') return 200_000_000_000n
  if (method === 'eth_chainId') return anvilZksync.chain.id
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn

const baseClient = anvilZksync.getClient({ batch: { multicall: false } })
baseClient.request = request
const client = baseClient.extend(publicActionsL2())

const baseClientWithAccount = anvilZksync.getClient({
  account: true,
  batch: { multicall: false },
})
baseClientWithAccount.request = request
const clientWithAccount = baseClientWithAccount.extend(publicActionsL2())

test('default', async () => {
  expect(
    await withdraw(client, {
      account: privateKeyToAccount(accounts[0].privateKey),
      amount: 7_000_000_000n,
      token: legacyEthAddress,
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  expect(
    await withdraw(clientWithAccount, {
      amount: 7_000_000_000n,
      token: legacyEthAddress,
    }),
  ).toBeDefined()
})

test('errors: no account provided', async () => {
  await expect(() =>
    withdraw(client, {
      amount: 7_000_000_000n,
      token: legacyEthAddress,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [AccountNotFoundError: Could not find an Account to execute with this Action.
      Please provide an Account with the \`account\` argument on the Action, or by supplying an \`account\` to the Client.

      Docs: https://viem.sh/docs/actions/wallet/sendTransaction
      Version: viem@x.y.z]
  `)
})

const hyperchainClient = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActions)

const hyperchainClientWithAccount = createWalletClient({
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(publicActions)

const customHyperchainClient = createPublicClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActions)

const customHyperchainClientWithAccount = createWalletClient({
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActions)

const account = privateKeyToAccount(zksyncAccounts[0].privateKey)

test('ETH: withdraw base token', async () => {
  const amount = 7_000_000_000n
  const balanceBeforeWithdrawal = await hyperchainClient.getBalance({
    address: account.address,
  })
  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: legacyEthAddress,
  })
  const receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await hyperchainClient.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw base token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal = await hyperchainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await hyperchainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(hyperchainClient, {
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
  const receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await hyperchainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await hyperchainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
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
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })
  const balanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  const hash = await withdraw(hyperchainClient, {
    account,
    amount,
    token: daiL2,
  })
  const receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('ETH: withdraw DAI token using paymaster', async () => {
  const amount = 5n
  const minimalAllowance = 1n
  const daiL2 = await getL2TokenAddress(hyperchainClient, { token: daiL1 })

  const balanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal = await hyperchainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(hyperchainClient, {
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

  const receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal = await hyperchainClient.getBalance({
    address: paymaster,
  })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClient,
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

  const balanceBeforeWithdrawal = await hyperchainClientWithAccount.getBalance({
    address: account.address,
  })
  const hash = await withdraw(hyperchainClientWithAccount, {
    amount,
    token: legacyEthAddress,
  })
  const receipt = await hyperchainClientWithAccount.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await hyperchainClientWithAccount.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('ETH: withdraw base token using paymaster and account hoisting', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal = await hyperchainClientWithAccount.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClientWithAccount,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal =
    await hyperchainClientWithAccount.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    hyperchainClientWithAccount,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(hyperchainClientWithAccount, {
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
  const receipt = await hyperchainClientWithAccount.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await hyperchainClientWithAccount.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClientWithAccount,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal =
    await hyperchainClientWithAccount.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    hyperchainClientWithAccount,
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
  const ethL2 = await getL2TokenAddress(customHyperchainClient, {
    token: ethAddressInContracts,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    ethL2,
    account.address,
  )
  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: ethL2,
  })
  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    ethL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('Custom: withdraw ETH token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n
  const ethL2 = await getL2TokenAddress(customHyperchainClient, {
    token: ethAddressInContracts,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    ethL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customHyperchainClient, {
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

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    ethL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
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
  const balanceBeforeWithdrawal = await customHyperchainClient.getBalance({
    address: account.address,
  })
  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: l2BaseTokenAddress,
  })
  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customHyperchainClient.getBalance({
    address: account.address,
  })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token using paymaster', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal = await customHyperchainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customHyperchainClient, {
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

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await customHyperchainClient.getBalance({
    address: account.address,
  })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
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
  const daiL2 = await getL2TokenAddress(customHyperchainClient, {
    token: daiL1,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    daiL2,
    account.address,
  )
  const hash = await withdraw(customHyperchainClient, {
    account,
    amount,
    token: daiL2,
  })
  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    daiL2,
    account.address,
  )
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal).equal(amount)
})

test('Custom: withdraw DAI token using paymaster', async () => {
  const amount = 5n
  const minimalAllowance = 1n
  const daiL2 = await getL2TokenAddress(customHyperchainClient, {
    token: daiL1,
  })

  const balanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customHyperchainClient, {
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

  const receipt = await customHyperchainClient.waitForTransactionReceipt({
    hash: hash,
  })
  const balanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    daiL2,
    account.address,
  )
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal =
    await customHyperchainClient.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClient,
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

  const balanceBeforeWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: account.address,
    })
  const hash = await withdraw(customHyperchainClientWithAccount, {
    amount,
    token: l2BaseTokenAddress,
  })
  const receipt =
    await customHyperchainClientWithAccount.waitForTransactionReceipt({
      hash: hash,
    })
  const balanceAfterWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: account.address,
    })
  expect(receipt.status).equals('success')
  expect(balanceBeforeWithdrawal - balanceAfterWithdrawal >= amount).true
})

test('Custom: withdraw base token using paymaster and account hoisting', async () => {
  const amount = 7_000_000_000n
  const minimalAllowance = 1n

  const balanceBeforeWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: account.address,
    })
  const approvalTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClientWithAccount,
    approvalToken,
    account.address,
  )
  const paymasterBalanceBeforeWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceBeforeWithdrawal = await getTokenBalance(
    customHyperchainClientWithAccount,
    approvalToken,
    paymaster,
  )

  const hash = await withdraw(customHyperchainClientWithAccount, {
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

  const receipt =
    await customHyperchainClientWithAccount.waitForTransactionReceipt({
      hash: hash,
    })
  const balanceAfterWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: account.address,
    })
  const approvalTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClientWithAccount,
    approvalToken,
    account.address,
  )
  const paymasterBalanceAfterWithdrawal =
    await customHyperchainClientWithAccount.getBalance({
      address: paymaster,
    })
  const paymasterTokenBalanceAfterWithdrawal = await getTokenBalance(
    customHyperchainClientWithAccount,
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
