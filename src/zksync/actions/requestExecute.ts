import type { Address } from 'abitype'
import type { Hex } from 'viem'
import { ClientChainNotConfiguredError } from '~viem/errors/chain.js'
import type { GetAccountParameter } from '~viem/types/account.js'
import {
  BaseFeeHigherThanValueError,
  type BaseFeeHigherThanValueErrorType,
} from '~viem/zksync/errors/bridge.js'
import { generatePrivateKey } from '../../accounts/generatePrivateKey.js'
import type { Account } from '../../accounts/types.js'
import { privateKeyToAddress } from '../../accounts/utils/privateKeyToAddress.js'
import { readContract } from '../../actions/public/readContract.js'
import {
  type SendTransactionErrorType,
  type SendTransactionParameters,
  type SendTransactionRequest,
  type SendTransactionReturnType,
  sendTransaction,
} from '../../actions/wallet/sendTransaction.js'
import type { Client } from '../../clients/createClient.js'
import { publicActions } from '../../clients/decorators/public.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import { AccountNotFoundError } from '../../errors/account.js'
import type { Chain, GetChainParameter } from '../../types/chain.js'
import {
  encodeFunctionData,
  isAddressEqual,
  parseAccount,
} from '../../utils/index.js'
import { bridgehubAbi } from '../constants/abis.js'
import { ethAddressInContracts } from '../constants/address.js'
import { requiredL1ToL2GasPerPubdataLimit } from '../constants/number.js'
import type { ChainEIP712 } from '../types/chain.js'
import { estimateGasL1ToL2 } from './estimateGasL1ToL2.js'
import { getBridgehubContractAddress } from './getBridgehubContractAddress.js'

export type RequestExecuteParameters<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  chainL2 extends ChainEIP712 | undefined = ChainEIP712 | undefined,
  request extends SendTransactionRequest<
    chain,
    chainOverride
  > = SendTransactionRequest<chain, chainOverride>,
> = Omit<
  SendTransactionParameters<chain, account, chainOverride, request>,
  'data' | 'to' | 'chain' | 'account'
> &
  Partial<GetChainParameter<chain, chainOverride>> &
  Partial<GetAccountParameter<account>> & {
    client: Client<Transport, chainL2, account>
    contractAddress: Address
    calldata: Hex
    l2GasLimit?: bigint
    mintValue?: bigint
    l2Value?: bigint
    factoryDeps?: Hex[]
    operatorTip?: bigint
    gasPerPubdataByte?: bigint
    refundRecipient?: Address
  }

// TODO check if can work as PriorityOpResponse as return type
export type RequestExecuteReturnType = SendTransactionReturnType

export type RequestExecuteErrorType =
  | SendTransactionErrorType
  | BaseFeeHigherThanValueErrorType

export async function requestExecute<
  chain extends Chain | undefined,
  account extends Account | undefined,
  const request extends SendTransactionRequest<chain, chainOverride>,
  chainOverride extends Chain | undefined = Chain | undefined,
  chainL2 extends ChainEIP712 | undefined = ChainEIP712 | undefined,
>(
  client: Client<Transport, chain, account>,
  parameters: RequestExecuteParameters<
    chain,
    account,
    chainOverride,
    chainL2,
    request
  >,
): Promise<RequestExecuteReturnType> {
  let {
    account: account_ = client.account,
    chain: chain_ = client.chain,
    contractAddress,
    calldata,
    l2Value,
    mintValue,
    operatorTip,
    factoryDeps,
    gasPerPubdataByte,
    refundRecipient,
    l2GasLimit,
    value,
  } = parameters
  const l2Client = parameters.client
  const acc = account_ ? parseAccount(account_) : client.account
  if (!acc)
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/sendTransaction',
    })
  if (!l2Client.chain) throw new ClientChainNotConfiguredError()

  const bridgehub = await getBridgehubContractAddress(client)
  const baseToken = await readContract(client, {
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'baseToken',
    args: [BigInt(l2Client.chain.id)],
  })
  const isETHBasedChain = isAddressEqual(baseToken, ethAddressInContracts)

  l2Value ??= 0n
  mintValue ??= 0n
  operatorTip ??= 0n
  factoryDeps ??= []
  gasPerPubdataByte ??= requiredL1ToL2GasPerPubdataLimit
  refundRecipient ??= acc.address
  l2GasLimit ??= await estimateGasL1ToL2(l2Client, {
    chain: l2Client.chain,
    // If the `from` address is not provided, we use a random address, because
    // due to storage slot aggregation, the gas estimation will depend on the address
    // and so estimation for the zero address may be smaller than for the sender.
    account:
      l2Client.account ??
      parseAccount(privateKeyToAddress(generatePrivateKey())),
    data: calldata,
    to: contractAddress,
    value: l2Value,
    gasPerPubdataByte,
    factoryDeps,
  })

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeePrice(client)

  const baseCost = await readContract(client, {
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'l2TransactionBaseCost',
    args: [
      BigInt(l2Client.chain.id),
      maxFeePerGas,
      l2GasLimit,
      gasPerPubdataByte,
    ],
  })

  const l2Costs = baseCost + operatorTip + l2Value
  let providedValue = isETHBasedChain ? value : mintValue
  if (!providedValue || providedValue === 0n) {
    providedValue = l2Costs
  }

  if (baseCost > providedValue)
    throw new BaseFeeHigherThanValueError(baseCost, providedValue)

  const data = encodeFunctionData({
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionDirect',
    args: [
      {
        chainId: BigInt(l2Client.chain.id),
        mintValue: providedValue,
        l2Contract: contractAddress,
        l2Value: l2Value,
        l2Calldata: calldata,
        l2GasLimit: l2GasLimit,
        l2GasPerPubdataByteLimit: gasPerPubdataByte,
        factoryDeps: factoryDeps,
        refundRecipient: refundRecipient,
      },
    ],
  })

  return await sendTransaction(client, {
    chain: chain_,
    account: acc,
    to: bridgehub,
    data,
    maxFeePerGas,
    maxPriorityFeePerGas,
    value: isETHBasedChain ? providedValue : value,
  })
}

async function getFeePrice<chain extends Chain | undefined>(
  client: Client<Transport, chain>,
) {
  const client_ = client.extend(publicActions)
  const block = await client_.getBlock()
  const baseFee =
    typeof block.baseFeePerGas !== 'bigint'
      ? await client_.getGasPrice()
      : block.baseFeePerGas
  const maxPriorityFeePerGas = await client_.estimateMaxPriorityFeePerGas()

  return {
    maxFeePerGas: (baseFee * 3n) / 2n + maxPriorityFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
  }
}
