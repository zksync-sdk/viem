import { expect, test } from 'vitest'
import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import { accounts } from '~test/src/constants.js'
import {
  daiL1,
  mockFailedDepositReceipt,
  mockFailedDepositTransaction,
  mockLogProof,
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
import { wait } from '~viem/utils/wait.js'
import { claimFailedDeposit } from '~viem/zksync/actions/claimFailedDeposit.js'
import { getBaseTokenL1Address } from '~viem/zksync/actions/getBaseTokenL1Address.js'
import {
  type ZksyncBlockDetails,
  getL2HashFromPriorityOp,
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
  if (method === 'eth_getTransactionReceipt') return mockFailedDepositReceipt
  if (method === 'eth_getTransactionByHash') return mockFailedDepositTransaction
  if (method === 'zks_getL2ToL1LogProof') return mockLogProof
  if (method === 'eth_call')
    return '0x00000000000000000000000070a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
  if (method === 'eth_estimateGas') return 158774n
  return (
    (await mockRequestReturnData(method)) ??
    (await anvilZksync.getClient().request({ method, params } as any))
  )
}) as EIP1193RequestFn
const clientL2 = baseClientL2.extend(publicActionsL2())

test.skip('default', async () => {
  const account = privateKeyToAccount(accounts[0].privateKey)
  expect(
    claimFailedDeposit(client, {
      client: clientL2,
      account,
      depositHash:
        '0x5b08ec4c7ebb02c07a3f08bc5677aec87c47200f685f6389969a3c084bee13dc',
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  expect(
    claimFailedDeposit(clientWithAccount, {
      client: clientL2,
      depositHash:
        '0x5b08ec4c7ebb02c07a3f08bc5677aec87c47200f685f6389969a3c084bee13dc',
    }),
  ).toBeDefined()
})

test('errors: no account provided', async () => {
  await expect(() =>
    claimFailedDeposit(client, {
      client: clientL2,
      depositHash:
        '0x5b08ec4c7ebb02c07a3f08bc5677aec87c47200f685f6389969a3c084bee13dc',
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

test('ETH: should claim failed deposit', async () => {
  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    token: daiL1,
    to: account.address,
    amount: 7n,
    approveToken: true,
    refundRecipient: account.address,
    l2GasLimit: 300_000n, // make it fail because of low gas
  })

  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainClient.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('reverted')
  let blockDetails: ZksyncBlockDetails
  do {
    await wait(500)
    blockDetails = await hyperchainClient.getBlockDetails({
      number: Number(l2Receipt.blockNumber),
    })
  } while (!blockDetails || !blockDetails.executeTxHash)

  const claimFailedDepositHash = await claimFailedDeposit(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    depositHash: l2Hash,
  })
  const claimFailedDepositReceipt =
    await hyperchainL1Client.waitForTransactionReceipt({
      hash: claimFailedDepositHash,
    })
  expect(claimFailedDepositReceipt.status).equals('success')
})

test('ETH: should failed when trying to claim successful deposit', async () => {
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
      client: hyperchainClient,
      account,
      depositHash: l2Hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [CannotClaimSuccessfulDepositError: Cannot claim successful deposit: ${l2Hash}.

      Version: viem@x.y.z]
  `)
})

test('Custom: should failed when trying to claim successful deposit', async () => {
  const baseTokenL1 = await getBaseTokenL1Address(hyperchainCustomClient)

  const hash = await deposit(hyperchainL1Client, {
    client: hyperchainCustomClient,
    account,
    token: baseTokenL1,
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
  const l2Receipt = await hyperchainCustomClient.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  await expect(() =>
    claimFailedDeposit(hyperchainL1Client, {
      client: hyperchainCustomClient,
      account,
      depositHash: l2Hash,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [CannotClaimSuccessfulDepositError: Cannot claim successful deposit: ${l2Hash}.

      Version: viem@x.y.z]
  `)
})

test('errors: no account provided', async () => {
  await expect(() =>
    claimFailedDeposit(hyperchainL1Client, {
      client: hyperchainClient,
      depositHash:
        '0x5b08ec4c7ebb02c07a3f08bc5677aec87c47200f685f6389969a3c084bee13dc',
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [AccountNotFoundError: Could not find an Account to execute with this Action.
      Please provide an Account with the \`account\` argument on the Action, or by supplying an \`account\` to the Client.

      Docs: https://viem.sh/docs/actions/wallet/sendTransaction
      Version: viem@x.y.z]
  `)
})
