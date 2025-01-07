import type { Address } from 'abitype'
import {
  type GetTransactionReceiptErrorType,
  getTransactionReceipt,
} from '../../actions/public/getTransactionReceipt.js'
import type { Client } from '../../clients/createClient.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import type { Account } from '../../types/account.js'
import type { Chain } from '../../types/chain.js'
import type { Hash, Hex } from '../../types/misc.js'
import { isAddressEqual } from '../../utils/index.js'
import { bootloaderFormalAddress } from '../constants/address.js'
import {
  L2ToL1MessageLogNotFoundError,
  type L2ToL1MessageLogNotFoundErrorType,
} from '../errors/bridge.js'
import type { ZksyncTransactionReceipt } from '../types/transaction.js'
import { getLogProof } from './getLogProof.js'

export type GetPriorityOpConfirmationParameters = {
  /** The hash of the L2 transaction where the message was initiated. */
  hash: Hash
  /** In case there were multiple transactions in one message, you may pass an index of the
   transaction which confirmation data should be fetched. */
  index?: number
}

export type GetPriorityOpConfirmationReturnType = {
  l1BatchNumber: bigint
  l2MessageIndex: number
  l2TxNumberInBlock: bigint | null
  proof: Hex[]
}

export type GetPriorityOpConfirmationErrorType =
  | GetTransactionReceiptErrorType
  | L2ToL1MessageLogNotFoundErrorType

/**
 * Returns the transaction confirmation data that is part of `L2->L1` message.
 *
 * @param client - Client to use
 * @param parameters - {@link GetPriorityOpConfirmationParameters}
 * @returns The transaction confirmation data that is part of `L2->L1` message.
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { zksync } from 'viem/chains'
 * import { getPriorityOpConfirmation } from 'viem/zksync'
 *
 * const client = createPublicClient({
 *   chain: zksync,
 *   transport: http(),
 * })
 *
 * const address = await getPriorityOpConfirmation(client, {hash: '0x...'})
 */
export async function getPriorityOpConfirmation<
  chain extends Chain | undefined,
  account extends Account | undefined,
>(
  client: Client<Transport, chain, account>,
  parameters: GetPriorityOpConfirmationParameters,
): Promise<GetPriorityOpConfirmationReturnType> {
  const { hash, index = 0 } = parameters
  const receipt = (await getTransactionReceipt(client, {
    hash,
  })) as ZksyncTransactionReceipt
  const messages = Array.from(receipt.l2ToL1Logs.entries()).filter(([, log]) =>
    isAddressEqual(log.sender as Address, bootloaderFormalAddress),
  )
  const [l2ToL1LogIndex, l2ToL1Log] = messages[index]
  const proof = await getLogProof(client, {
    txHash: hash,
    index: l2ToL1LogIndex,
  })
  if (!proof) throw new L2ToL1MessageLogNotFoundError({ hash })

  return {
    l1BatchNumber: l2ToL1Log.l1BatchNumber,
    l2MessageIndex: proof.id,
    l2TxNumberInBlock: receipt.l1BatchTxIndex,
    proof: proof.proof,
  }
}
