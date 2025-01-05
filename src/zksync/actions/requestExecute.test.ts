import { expect, test } from 'vitest'
import { anvilMainnet, anvilZksync } from '~test/src/anvil.js'
import { accounts } from '~test/src/constants.js'
import {
  approveToken,
  mockRequestReturnData,
  zksyncAccounts,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { readContract } from '~viem/actions/public/readContract.js'
import {
  http,
  type EIP1193RequestFn,
  createPublicClient,
  publicActions,
} from '~viem/index.js'
import { bridgehubAbi } from '~viem/zksync/constants/abis.js'
import {
  getL2HashFromPriorityOp,
  publicActionsL2,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/index.js'
import { requestExecute } from './requestExecute.js'

const request = (async ({ method, params }) => {
  if (method === 'eth_sendRawTransaction')
    return '0x9afe47f3d95eccfc9210851ba5f877f76d372514a26b48bad848a07f77c33b87'
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
    await requestExecute(client, {
      account: privateKeyToAccount(accounts[0].privateKey),
      client: clientL2,
      contractAddress: await clientL2.getBridgehubContractAddress(),
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
      gasPrice: 200_000_000_000n,
      gas: 500_000n,
    }),
  ).toBeDefined()
})

test('default: account hoisting', async () => {
  expect(
    await requestExecute(clientWithAccount, {
      client: clientL2,
      contractAddress: await clientL2.getBridgehubContractAddress(),
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
      gasPrice: 200_000_000_000n,
      gas: 500_000n,
    }),
  ).toBeDefined()
})

test('errors: no account provided', async () => {
  const bridgehub = await clientL2.getBridgehubContractAddress()
  await expect(() =>
    requestExecute(client, {
      client: clientL2,
      contractAddress: bridgehub,
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
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
}).extend(publicActionsL2())

const hyperchainL2Client = createPublicClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
}).extend(publicActionsL2())

const hyperchainL1Client = createPublicClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
})

const account = privateKeyToAccount(zksyncAccounts[0].privateKey)

test('ETH: request execute', async () => {
  const amount = 7_000_000_000n
  const l1BalanceBeforeExecution = await hyperchainL1Client.getBalance(account)
  const l2BalanceBeforeExecution = await hyperchainClient.getBalance(account)

  const hash = await requestExecute(hyperchainL1Client, {
    client: hyperchainClient,
    account,
    contractAddress: await hyperchainClient.getBridgehubContractAddress(),
    calldata: '0x',
    l2Value: amount,
    l2GasLimit: 900_000n,
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

  const l1BalanceAfterExecution = await hyperchainL1Client.getBalance(account)
  const l2BalanceAfterExecution = await hyperchainClient.getBalance(account)
  expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).true
  expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).true
})

test('Custom: request execute', async () => {
  const amount = 7_000_000_000n
  const baseToken = await readContract(hyperchainL1Client, {
    address: await hyperchainL2Client.getBridgehubContractAddress(),
    abi: bridgehubAbi,
    functionName: 'baseToken',
    args: [BigInt(hyperchainL2Client.chain.id)],
  })

  const l1BalanceBeforeExecution = await hyperchainL1Client.getBalance(account)
  const l2BalanceBeforeExecution = await hyperchainL2Client.getBalance(account)

  await approveToken(
    hyperchainL1Client.chain,
    baseToken,
    (await hyperchainL2Client.getDefaultBridgeAddresses()).sharedL1,
    500_000_000_000_000n,
  )

  const hash = await requestExecute(hyperchainL1Client, {
    client: hyperchainL2Client,
    account,
    contractAddress: account.address,
    calldata: '0x',
    l2Value: amount,
    l2GasLimit: 1_319_957n,
  })
  const receipt = await hyperchainL1Client.waitForTransactionReceipt({ hash })
  expect(receipt.status).equals('success')
  const l2Hash = getL2HashFromPriorityOp(
    receipt,
    await hyperchainL2Client.getMainContractAddress(),
  )
  const l2Receipt = await hyperchainL2Client.waitForTransactionReceipt({
    hash: l2Hash,
  })
  expect(l2Receipt.status).equals('success')

  const l1BalanceAfterExecution = await hyperchainL1Client.getBalance(account)
  const l2BalanceAfterExecution = await hyperchainL2Client.getBalance(account)
  expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).true
  expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).true
})

test('errors: no account provided', async () => {
  const bridgehub = await hyperchainClient.getBridgehubContractAddress()
  await expect(() =>
    requestExecute(hyperchainL1Client, {
      client: hyperchainClient,
      contractAddress: bridgehub,
      calldata: '0x',
      l2Value: 7_000_000_000n,
      l2GasLimit: 900_000n,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [AccountNotFoundError: Could not find an Account to execute with this Action.
      Please provide an Account with the \`account\` argument on the Action, or by supplying an \`account\` to the Client.

      Docs: https://viem.sh/docs/actions/wallet/sendTransaction
      Version: viem@x.y.z]
  `)
})
