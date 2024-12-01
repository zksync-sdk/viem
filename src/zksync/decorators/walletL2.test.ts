import { beforeAll, expect, test } from 'vitest'

import {
  accounts,
  approvalToken,
  paymaster,
  setupCustomHyperchain,
  setupHyperchain,
} from '~test/src/zksync.js'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { createWalletClient } from '~viem/clients/createWalletClient.js'
import { http } from '~viem/clients/transports/http.js'
import { legacyEthAddress } from '~viem/zksync/constants/address.js'
import { getApprovalBasedPaymasterInput } from '~viem/zksync/utils/paymaster/getApprovalBasedPaymasterInput.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { zksyncLocalHyperchain } from '../chains.js'
import { walletActionsL2 } from './walletL2.js'

const zksyncClient = createPublicClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(walletActionsL2())

beforeAll(async () => {
  await setupHyperchain()
  await setupCustomHyperchain()
})

const zksyncWallet = createWalletClient({
  account: privateKeyToAccount(accounts[0].privateKey),
  chain: zksyncLocalHyperchain,
  transport: http(),
}).extend(walletActionsL2())

const account = privateKeyToAccount(accounts[0].privateKey)

test('withdraw', async () => {
  expect(
    await zksyncClient.withdraw({
      account,
      amount: 7_000_000_000n,
      token: legacyEthAddress,
      paymaster: paymaster,
      paymasterInput: getApprovalBasedPaymasterInput({
        minAllowance: 1n,
        token: approvalToken,
        innerInput: new Uint8Array(),
      }),
    }),
  ).toBeDefined()
})

test('withdraw hoisting', async () => {
  expect(
    await zksyncWallet.withdraw({
      amount: 7_000_000_000n,
      token: legacyEthAddress,
      paymaster: paymaster,
      paymasterInput: getApprovalBasedPaymasterInput({
        minAllowance: 1n,
        token: approvalToken,
        innerInput: new Uint8Array(),
      }),
    }),
  ).toBeDefined()
})
