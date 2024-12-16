import { beforeAll, expect, test } from 'vitest'
import {
  accounts,
  approveToken,
  setupCustomHyperchain,
  setupHyperchain,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { readContract } from '~viem/actions/public/readContract.js'
import { createPublicClient } from '~viem/clients/createPublicClient.js'
import { http } from '~viem/clients/transports/http.js'
import { requestExecute } from '~viem/zksync/actions/requestExecute.js'
import {
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
} from '~viem/zksync/chains.js'
import { bridgehubAbi } from '~viem/zksync/constants/abis.js'
import { publicActionsL2 } from '~viem/zksync/decorators/publicL2.js'
import { getL2HashFromPriorityOp } from '~viem/zksync/utils/bridge/getL2HashFromPriorityOp.js'

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

test('ETH: request execute', async () => {
  const amount = 7_000_000_000n
  const l1BalanceBeforeExecution = await client.getBalance(account)
  const l2BalanceBeforeExecution = await clientL2.getBalance(account)

  const hash = await requestExecute(client, {
    client: clientL2,
    account,
    contractAddress: await clientL2.getBridgehubContractAddress(),
    calldata: '0x',
    l2Value: amount,
    l2GasLimit: 900_000n,
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

  const l1BalanceAfterExecution = await client.getBalance(account)
  const l2BalanceAfterExecution = await clientL2.getBalance(account)
  expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).true
  expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).true
})

test('Custom: request execute', async () => {
  const amount = 7_000_000_000n
  const baseToken = await readContract(client, {
    address: await clientL2Custom.getBridgehubContractAddress(),
    abi: bridgehubAbi,
    functionName: 'baseToken',
    args: [BigInt(clientL2Custom.chain.id)],
  })

  const l1BalanceBeforeExecution = await client.getBalance(account)
  const l2BalanceBeforeExecution = await clientL2Custom.getBalance(account)

  await approveToken(
    client.chain,
    baseToken,
    (await clientL2Custom.getDefaultBridgeAddresses()).sharedL1,
    500_000_000_000_000n,
  )

  const hash = await requestExecute(client, {
    client: clientL2Custom,
    account,
    contractAddress: account.address,
    calldata: '0x',
    l2Value: amount,
    l2GasLimit: 1_319_957n,
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

  const l1BalanceAfterExecution = await client.getBalance(account)
  const l2BalanceAfterExecution = await clientL2Custom.getBalance(account)
  expect(l1BalanceBeforeExecution - l1BalanceAfterExecution >= amount).true
  expect(l2BalanceAfterExecution - l2BalanceBeforeExecution >= amount).true
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
