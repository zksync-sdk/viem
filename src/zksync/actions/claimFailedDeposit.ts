import type { Address } from 'abitype'
import { ethers } from 'ethers'
import type { Hex } from 'viem'
import type { Account } from '../../accounts/types.js'
import { getTransaction } from '../../actions/public/getTransaction.js'
import {
  type GetTransactionReceiptErrorType,
  getTransactionReceipt,
} from '../../actions/public/getTransactionReceipt.js'
import {
  type SendTransactionErrorType,
  type SendTransactionParameters,
  type SendTransactionRequest,
  type SendTransactionReturnType,
  sendTransaction,
} from '../../actions/wallet/sendTransaction.js'
import type { Client } from '../../clients/createClient.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import { AccountNotFoundError } from '../../errors/account.js'
import {
  ChainNotFoundError,
  type ChainNotFoundErrorType,
} from '../../errors/chain.js'
import type { Chain } from '../../types/chain.js'
import {
  decodeAbiParameters,
  encodeFunctionData,
  isAddressEqual,
  parseAccount,
} from '../../utils/index.js'
import { l1SharedBridgeAbi, l2SharedBridgeAbi } from '../constants/abis.js'
import { bootloaderFormalAddress } from '../constants/address.js'
import {
  CannotClaimSuccessfulDepositError,
  type CannotClaimSuccessfulDepositErrorType,
  L2ToL1MessageLogNotFoundError,
} from '../errors/bridge.js'
import type { ChainEIP712 } from '../types/chain.js'
import type { ZksyncTransactionReceipt } from '../types/transaction.js'
import { undoL1ToL2Alias } from '../utils/bridge/undoL1ToL2Alias.js'
import { getLogProof } from './getLogProof.js'

export type ClaimFailedDepositParameters<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  chainL2 extends ChainEIP712 | undefined = ChainEIP712 | undefined,
  accountL2 extends Account | undefined = Account | undefined,
  request extends SendTransactionRequest<
    chain,
    chainOverride
  > = SendTransactionRequest<chain, chainOverride>,
> = Omit<
  SendTransactionParameters<chain, account, chainOverride, request>,
  'value' | 'data' | 'to'
> & {
  /** L2 client */
  client: Client<Transport, chainL2, accountL2>
  /** The L2 transaction hash of the failed deposit. */
  hash: Hex
}

export type ClaimFailedDepositReturnType = SendTransactionReturnType

export type ClaimFailedDepositErrorType =
  | GetTransactionReceiptErrorType
  | SendTransactionErrorType
  | ChainNotFoundErrorType
  | CannotClaimSuccessfulDepositErrorType

/**
 * Withdraws funds from the initiated deposit, which failed when finalizing on L2.
 * If the deposit L2 transaction has failed, it sends an L1 transaction calling `claimFailedDeposit` method of the
 * L1 bridge, which results in returning L1 tokens back to the depositor.
 *
 * @param client - Client to use
 * @param parameters - {@link ClaimFailedDepositParameters}
 * @returns hash - The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link ClaimFailedDepositReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet, zksync } from 'viem/chains'
 * import { claimFailedDeposit } from 'viem/zksync'
 *
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const clientL2 = createPublicClient({
 *   chain: zksync,
 *   transport: http(),
 * })
 *
 * const hash = await claimFailedDeposit(client, {
 *     account: privateKeyToAccount('0x…'),
 *     client: clientL2,
 *     hash: '0x...',
 * })
 *
 * @example Account Hoisting
 * import { createPublicClient, createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { mainnet, zksync } from 'viem/chains'
 * import { claimFailedDeposit } from 'viem/zksync'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const clientL2 = createPublicClient({
 *   chain: zksync,
 *   transport: http(),
 * })
 *
 * const hash = await claimFailedDeposit(client, {
 *     client: clientL2,
 *     hash: '0x…',
 * })
 */
export async function claimFailedDeposit<
  chain extends Chain | undefined,
  account extends Account | undefined,
  accountL2 extends Account | undefined,
  const request extends SendTransactionRequest<chain, chainOverride>,
  chainOverride extends Chain | undefined,
  chainL2 extends ChainEIP712 | undefined,
>(
  client: Client<Transport, chain, account>,
  parameters: ClaimFailedDepositParameters<
    chain,
    account,
    chainOverride,
    chainL2,
    accountL2,
    request
  >,
): Promise<ClaimFailedDepositReturnType> {
  const {
    account: account_ = client.account,
    client: l2Client,
    hash,
    ...rest
  } = parameters

  const account = account_ ? parseAccount(account_) : client.account
  if (!account)
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/sendTransaction',
    })
  if (!l2Client.chain) throw new ChainNotFoundError()

  const receipt = (await getTransactionReceipt(l2Client, {
    hash,
  })) as ZksyncTransactionReceipt
  const successL2ToL1LogIndex = receipt.l2ToL1Logs.findIndex(
    (l2ToL1log) =>
      isAddressEqual(l2ToL1log.sender as Address, bootloaderFormalAddress) &&
      l2ToL1log.key === hash,
  )
  const successL2ToL1Log = receipt.l2ToL1Logs[successL2ToL1LogIndex]
  if (successL2ToL1Log.value !== ethers.ZeroHash)
    throw new CannotClaimSuccessfulDepositError()

  const tx = await getTransaction(l2Client, { hash })

  // Undo the aliasing, since the Mailbox contract set it as for contract address.
  const l1Bridge = undoL1ToL2Alias(receipt.from)
  const finalizeDepositInputData = decodeAbiParameters(
    l2SharedBridgeAbi[2].inputs,
    tx.input,
  )
  const proof = await getLogProof(l2Client, {
    txHash: hash,
    index: successL2ToL1LogIndex,
  })
  if (!proof) throw new L2ToL1MessageLogNotFoundError({ hash })

  const data = encodeFunctionData({
    abi: l1SharedBridgeAbi,
    functionName: 'claimFailedDeposit',
    args: [
      BigInt(l2Client.chain.id),
      finalizeDepositInputData[0], // _l1Sender
      finalizeDepositInputData[2], // _l1Token
      finalizeDepositInputData[3], // _amount
      hash,
      receipt.l1BatchNumber!,
      BigInt(proof.id),
      Number(receipt.l1BatchTxIndex),
      proof.proof,
    ],
  })

  return await sendTransaction(client, {
    account,
    to: l1Bridge,
    data,
    ...rest,
  } as SendTransactionParameters)
}
