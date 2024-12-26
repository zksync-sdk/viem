import { type Address, parseAbi, parseAbiParameters } from 'abitype'
import { ZeroAddress } from 'ethers'
import type { Hex } from 'viem'
import type { Account } from '../../accounts/types.js'
import {
  type EstimateGasParameters,
  estimateGas,
} from '../../actions/public/estimateGas.js'
import { readContract } from '../../actions/public/readContract.js'
import { waitForTransactionReceipt } from '../../actions/public/waitForTransactionReceipt.js'
import {
  type SendTransactionErrorType,
  type SendTransactionParameters,
  type SendTransactionReturnType,
  sendTransaction,
} from '../../actions/wallet/sendTransaction.js'
import {
  type WriteContractParameters,
  writeContract,
} from '../../actions/wallet/writeContract.js'
import type { Client } from '../../clients/createClient.js'
import { publicActions } from '../../clients/decorators/public.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import { erc20Abi } from '../../constants/abis.js'
import { AccountNotFoundError } from '../../errors/account.js'
import { ClientChainNotConfiguredError } from '../../errors/chain.js'
import type { GetAccountParameter } from '../../types/account.js'
import type {
  Chain,
  DeriveChain,
  GetChainParameter,
} from '../../types/chain.js'
import type { UnionEvaluate, UnionOmit } from '../../types/utils.js'
import {
  type FormattedTransactionRequest,
  encodeAbiParameters,
  encodeFunctionData,
  isAddressEqual,
  parseAccount,
} from '../../utils/index.js'
import { bridgehubAbi } from '../constants/abis.js'
import {
  ethAddressInContracts,
  legacyEthAddress,
} from '../constants/address.js'
import { requiredL1ToL2GasPerPubdataLimit } from '../constants/number.js'
import {
  BaseFeeHigherThanValueError,
  type BaseFeeHigherThanValueErrorType,
} from '../errors/bridge.js'
import type { ChainEIP712 } from '../types/chain.js'
import { applyL1ToL2Alias } from '../utils/bridge/applyL1ToL2Alias.js'
import { estimateGasL1ToL2 } from './estimateGasL1ToL2.js'
import { getBridgehubContractAddress } from './getBridgehubContractAddress.js'
import { getDefaultBridgeAddresses } from './getDefaultBridgeAddresses.js'
import { getL1Allowance } from './getL1Allowance.js'
import { requestExecute } from './requestExecute.js'

export type DepositParameters<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  chainL2 extends ChainEIP712 | undefined = ChainEIP712 | undefined,
  accountL2 extends Account | undefined = Account | undefined,
  _derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>,
> = UnionEvaluate<
  UnionOmit<FormattedTransactionRequest<_derivedChain>, 'data' | 'to' | 'from'>
> &
  Partial<GetChainParameter<chain, chainOverride>> &
  Partial<GetAccountParameter<account>> & {
    /** L2 client. */
    client: Client<Transport, chainL2, accountL2>
    /** The address of the token to deposit. */
    token: Address
    /** The amount of the token to deposit. */
    amount: bigint
    /** The address that will receive the deposited tokens on L2. */
    to?: Address
    /** (currently not used) The tip the operator will receive on top of
    the base cost of the transaction. */
    operatorTip?: bigint
    /** Maximum amount of L2 gas that transaction can consume during execution on L2. */
    l2GasLimit?: bigint
    /** The L2 gas price for each published L1 calldata byte. */
    gasPerPubdataByte?: bigint
    /** The address on L2 that will receive the refund for the transaction.
    If the transaction fails, it will also be the address to receive `amount`. */
    refundRecipient?: Address
    /** The address of the bridge contract to be used.
    Defaults to the default ZKsync L1 shared bridge. */
    bridgeAddress?: Address
    /** Additional data that can be sent to a bridge. */
    customBridgeData?: Hex
    /** Whether token approval should be performed under the hood.
    Set this flag to true (or provide transaction overrides) if the bridge does
    not have sufficient allowance. The approval transaction is executed only if
    the bridge lacks sufficient allowance; otherwise, it is skipped. */
    approveToken?:
      | boolean
      | UnionEvaluate<
          UnionOmit<
            FormattedTransactionRequest<_derivedChain>,
            'data' | 'to' | 'from'
          >
        >
    /** Whether base token approval should be performed under the hood.
    Set this flag to true (or provide transaction overrides) if the bridge does
    not have sufficient allowance. The approval transaction is executed only if
    the bridge lacks sufficient allowance; otherwise, it is skipped. */
    approveBaseToken?:
      | boolean
      | UnionEvaluate<
          UnionOmit<
            FormattedTransactionRequest<_derivedChain>,
            'data' | 'to' | 'from'
          >
        >
  }

export type DepositReturnType = SendTransactionReturnType

export type DepositErrorType =
  | SendTransactionErrorType
  | BaseFeeHigherThanValueErrorType

/**
 * Transfers the specified token from the associated account on the L1 network to the target account on the L2 network.
 * The token can be either ETH or any ERC20 token. For ERC20 tokens, enough approved tokens must be associated with
 * the specified L1 bridge (default one or the one defined in `bridgeAddress`).
 * In this case, depending on is the chain ETH-based or not `approveToken` or `approveBaseToken`
 * can be enabled to perform token approval. If there are already enough approved tokens for the L1 bridge,
 * token approval will be skipped.
 *
 * @param client - Client to use
 * @param parameters - {@link DepositParameters}
 * @returns hash - The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link DepositReturnType}
 *
 * @example
 * import { createPublicClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { zksync, mainnet } from 'viem/chains'
 * import { deposit, legacyEthAddress, publicActionsL2 } from 'viem/zksync'
 *
 * const client = createPublicClient({
 *     chain: mainnet,
 *     transport: http(),
 * })
 *
 * const clientL2 = createPublicClient({
 *   chain: zksync,
 *   transport: http(),
 * }).extend(publicActionsL2())
 *
 * const account = privateKeyToAccount('0x…')
 *
 * const hash = await deposit(client, {
 *     client: clientL2,
 *     account,
 *     token: legacyEthAddress,
 *     to: account.address,
 *     amount: 1_000_000_000_000_000_000n,
 *     refundRecipient: account.address,
 * })
 *
 * @example Account Hoisting
 * import { createPublicClient, createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { zksync, mainnet } from 'viem/chains'
 * import { legacyEthAddress, publicActionsL2 } from 'viem/zksync'
 *
 * const walletClient = createWalletClient({
 *   chain: mainnet,
 *   transport: http(),
 *   account: privateKeyToAccount('0x…'),
 * })
 *
 * const clientL2 = createPublicClient({
 *   chain: zksync,
 *   transport: http(),
 * }).extend(publicActionsL2())
 *
 * const hash = await deposit(walletClient, {
 *     client: clientL2,
 *     account,
 *     token: legacyEthAddress,
 *     to: walletClient.account.address,
 *     amount: 1_000_000_000_000_000_000n,
 *     refundRecipient: walletClient.account.address,
 * })
 */
export async function deposit<
  chain extends Chain | undefined,
  account extends Account | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  chainL2 extends ChainEIP712 | undefined = ChainEIP712 | undefined,
  accountL2 extends Account | undefined = Account | undefined,
  _derivedChain extends Chain | undefined = DeriveChain<chain, chainOverride>,
>(
  client: Client<Transport, chain, account>,
  parameters: DepositParameters<
    chain,
    account,
    chainOverride,
    chainL2,
    accountL2
  >,
): Promise<DepositReturnType> {
  let {
    account: account_ = client.account,
    chain: chain_ = client.chain,
    client: l2Client,
    token,
    amount,
    to,
    operatorTip = 0n,
    l2GasLimit,
    gasPerPubdataByte = requiredL1ToL2GasPerPubdataLimit,
    refundRecipient = ZeroAddress as Address,
    bridgeAddress,
    customBridgeData,
    value,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    approveToken,
    approveBaseToken,
    gas,
    ...rest
  } = parameters

  const account = account_ ? parseAccount(account_) : client.account
  if (!account)
    throw new AccountNotFoundError({
      docsPath: '/docs/actions/wallet/sendTransaction',
    })
  if (!l2Client.chain) throw new ClientChainNotConfiguredError()

  if (isAddressEqual(token, legacyEthAddress)) token = ethAddressInContracts

  const bridgeAddresses = await getDefaultBridgeAddresses(l2Client)
  const bridgehub = await getBridgehubContractAddress(l2Client)
  const baseToken = await readContract(client, {
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'baseToken',
    args: [BigInt(l2Client.chain.id)],
  })
  const isETHBasedChain = isAddressEqual(baseToken, ethAddressInContracts)

  to ??= account.address
  l2GasLimit = bridgeAddress
    ? await getL2GasLimitFromCustomBridge(
        client,
        l2Client,
        account.address,
        token,
        amount,
        to,
        gasPerPubdataByte,
        bridgeAddress,
        customBridgeData,
      )
    : await getL2GasLimitFromDefaultBridge(
        client,
        l2Client,
        account.address,
        token,
        amount,
        to,
        gasPerPubdataByte,
        baseToken,
      )
  let gasPriceForEstimation = maxFeePerGas || gasPrice
  if (!gasPriceForEstimation) {
    const estimatedFee = await getFeePrice(client)
    gasPriceForEstimation = estimatedFee.maxFeePerGas
    maxFeePerGas = estimatedFee.maxFeePerGas
    maxPriorityFeePerGas ??= estimatedFee.maxPriorityFeePerGas
  }

  const baseCost = await readContract(client, {
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'l2TransactionBaseCost',
    args: [
      BigInt(l2Client.chain.id),
      gasPriceForEstimation,
      l2GasLimit,
      gasPerPubdataByte,
    ],
  })

  if (isETHBasedChain && isAddressEqual(token, ethAddressInContracts)) {
    // Deposit ETH on ETH-based chain
    const mintValue = baseCost + operatorTip + amount
    if (!gas) {
      const baseGasLimit = await estimateGas(client, {
        account: account.address,
        to: bridgehub,
        value: mintValue,
        data: encodeFunctionData({
          abi: bridgehubAbi,
          functionName: 'requestL2TransactionDirect',
          args: [
            {
              chainId: BigInt(l2Client.chain.id),
              mintValue,
              l2Contract: to,
              l2Value: amount,
              l2Calldata: '0x',
              l2GasLimit,
              l2GasPerPubdataByteLimit: gasPerPubdataByte,
              factoryDeps: [],
              refundRecipient,
            },
          ],
        }),
      } as EstimateGasParameters)
      gas = scaleGasLimit(baseGasLimit)
    }

    return await requestExecute(client, {
      chain: chain_,
      account,
      client: l2Client,
      contractAddress: to,
      calldata: '0x',
      l2GasLimit,
      mintValue,
      l2Value: amount,
      gasPerPubdataByte,
      refundRecipient,
      gas,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      ...rest,
    })
  }
  if (isAddressEqual(baseToken, ethAddressInContracts)) {
    // Deposit token on ETH-based chain
    const mintValue = baseCost + BigInt(operatorTip)
    if (baseCost > mintValue)
      throw new BaseFeeHigherThanValueError(baseCost, mintValue)

    bridgeAddress ??= bridgeAddresses.sharedL1
    if (approveToken) {
      const overrides = typeof approveToken === 'boolean' ? {} : approveToken
      const allowance = await getL1Allowance(client, {
        token,
        bridgeAddress,
        account,
      })
      if (allowance < amount) {
        const hash = await writeContract(client, {
          chain: chain_,
          account,
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [bridgeAddress, amount],
          ...overrides,
        } satisfies WriteContractParameters as any)
        await waitForTransactionReceipt(client, { hash })
      }
    }

    const data = encodeFunctionData({
      abi: bridgehubAbi,
      functionName: 'requestL2TransactionTwoBridges',
      args: [
        {
          chainId: BigInt(l2Client.chain.id),
          mintValue,
          l2Value: 0n,
          l2GasLimit,
          l2GasPerPubdataByteLimit: gasPerPubdataByte,
          refundRecipient,
          secondBridgeAddress: bridgeAddress,
          secondBridgeValue: 0n,
          secondBridgeCalldata: encodeAbiParameters(
            parseAbiParameters('address x, uint256 y, address z'),
            [token, amount, to],
          ),
        },
      ],
    })

    if (!gas) {
      const baseGasLimit = await estimateGas(client, {
        account: account.address,
        to: bridgehub,
        value: mintValue,
        data,
      } as EstimateGasParameters)
      gas = scaleGasLimit(baseGasLimit)
    }

    return await sendTransaction(client, {
      chain: chain_,
      account,
      to: bridgehub,
      data,
      value: mintValue,
      gas,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      ...rest,
    } as SendTransactionParameters)
  }
  if (isAddressEqual(token, ethAddressInContracts)) {
    // Deposit ETH on custom chain
    const mintValue = baseCost + operatorTip
    if (baseCost > mintValue)
      throw new BaseFeeHigherThanValueError(baseCost, mintValue)

    bridgeAddress = bridgeAddresses.sharedL1
    if (approveBaseToken) {
      const overrides = typeof approveToken === 'boolean' ? {} : approveToken
      const allowance = await getL1Allowance(client, {
        token: baseToken,
        bridgeAddress,
        account,
      })
      if (allowance < mintValue) {
        const hash = await writeContract(client, {
          chain: chain_,
          account,
          address: baseToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [bridgeAddress, mintValue],
          ...overrides,
        } satisfies WriteContractParameters as any)
        await waitForTransactionReceipt(client, { hash })
      }
    }

    const data = encodeFunctionData({
      abi: bridgehubAbi,
      functionName: 'requestL2TransactionTwoBridges',
      args: [
        {
          chainId: BigInt(l2Client.chain.id),
          mintValue,
          l2Value: 0n,
          l2GasLimit,
          l2GasPerPubdataByteLimit: gasPerPubdataByte,
          refundRecipient,
          secondBridgeAddress: bridgeAddress,
          secondBridgeValue: amount,
          secondBridgeCalldata: encodeAbiParameters(
            parseAbiParameters('address x, uint256 y, address z'),
            [ethAddressInContracts, 0n, to],
          ),
        },
      ],
    })

    if (!gas) {
      const baseGasLimit = await estimateGas(client, {
        account: account.address,
        to: bridgehub,
        value: amount,
        data,
      } as EstimateGasParameters)
      gas = scaleGasLimit(baseGasLimit)
    }

    return await sendTransaction(client, {
      chain: chain_,
      account,
      to: bridgehub,
      data,
      value: amount,
      gas,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      ...rest,
    } as SendTransactionParameters)
  }
  if (isAddressEqual(token, baseToken)) {
    // Deposit base token on custom chain
    const mintValue = baseCost + operatorTip + amount
    if (baseCost > mintValue)
      throw new BaseFeeHigherThanValueError(baseCost, mintValue)

    bridgeAddress = bridgeAddresses.sharedL1
    if (approveToken || approveBaseToken) {
      const overrides =
        typeof approveToken === 'boolean'
          ? {}
          : (approveToken ?? typeof approveBaseToken === 'boolean')
            ? {}
            : approveBaseToken
      const allowance = await getL1Allowance(client, {
        token: baseToken,
        bridgeAddress,
        account,
      })
      if (allowance < mintValue) {
        const hash = await writeContract(client, {
          chain: chain_,
          account,
          address: baseToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [bridgeAddress, mintValue],
          ...overrides,
        } satisfies WriteContractParameters as any)
        await waitForTransactionReceipt(client, { hash })
      }
    }

    if (!gas) {
      const baseGasLimit = await estimateGas(client, {
        account: account.address,
        to: bridgehub,
        value: 0n,
        data: encodeFunctionData({
          abi: bridgehubAbi,
          functionName: 'requestL2TransactionDirect',
          args: [
            {
              chainId: BigInt(l2Client.chain.id),
              mintValue,
              l2Contract: to,
              l2Value: amount,
              l2Calldata: '0x',
              l2GasLimit,
              l2GasPerPubdataByteLimit: gasPerPubdataByte,
              factoryDeps: [],
              refundRecipient,
            },
          ],
        }),
      } as EstimateGasParameters)
      gas = scaleGasLimit(baseGasLimit)
    }

    return await requestExecute(client, {
      chain: chain_,
      account,
      client: l2Client,
      contractAddress: to,
      calldata: '0x',
      l2GasLimit,
      mintValue,
      l2Value: amount,
      gasPerPubdataByte,
      refundRecipient,
      value: 0n,
      gas,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      ...rest,
    })
  }
  // Deposit token on custom chain
  value ??= 0n
  const mintValue = baseCost + operatorTip
  if (baseCost > mintValue)
    throw new BaseFeeHigherThanValueError(baseCost, mintValue)

  bridgeAddress ??= bridgeAddresses.sharedL1
  if (approveBaseToken) {
    const overrides = typeof approveToken === 'boolean' ? {} : approveToken
    const allowance = await getL1Allowance(client, {
      token: baseToken,
      bridgeAddress: bridgeAddresses.sharedL1,
      account,
    })
    if (allowance < mintValue) {
      const hash = await writeContract(client, {
        chain: chain_,
        account,
        address: baseToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [bridgeAddresses.sharedL1, mintValue],
        ...overrides,
      } satisfies WriteContractParameters as any)
      await waitForTransactionReceipt(client, { hash })
    }
  }

  if (approveToken) {
    const overrides = typeof approveToken === 'boolean' ? {} : approveToken
    const allowance = await getL1Allowance(client, {
      token,
      bridgeAddress,
      account,
    })
    if (allowance < amount) {
      const hash = await writeContract(client, {
        chain: chain_,
        account,
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [bridgeAddress, amount],
        ...overrides,
      } satisfies WriteContractParameters as any)
      await waitForTransactionReceipt(client, { hash })
    }
  }

  const data = encodeFunctionData({
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionTwoBridges',
    args: [
      {
        chainId: BigInt(l2Client.chain.id),
        mintValue,
        l2Value: 0n,
        l2GasLimit,
        l2GasPerPubdataByteLimit: gasPerPubdataByte,
        refundRecipient,
        secondBridgeAddress: bridgeAddress,
        secondBridgeValue: 0n,
        secondBridgeCalldata: encodeAbiParameters(
          parseAbiParameters('address x, uint256 y, address z'),
          [token, amount, to],
        ),
      },
    ],
  })

  if (!gas) {
    const baseGasLimit = await estimateGas(client, {
      account: account.address,
      to: bridgehub,
      value,
      data,
    } as EstimateGasParameters)
    gas = scaleGasLimit(baseGasLimit)
  }

  return await sendTransaction(client, {
    chain: chain_,
    account,
    to: bridgehub,
    data,
    value,
    gas,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    ...rest,
  } as SendTransactionParameters)
}

async function getL2GasLimitFromDefaultBridge<
  chain extends Chain | undefined,
  chainL2 extends ChainEIP712 | undefined,
>(
  client: Client<Transport, chain>,
  l2Client: Client<Transport, chainL2>,
  from: Address,
  token: Address,
  amount: bigint,
  to: Address,
  gasPerPubdataByte: bigint,
  baseTokenAddress: Address,
) {
  if (isAddressEqual(token, baseTokenAddress)) {
    return await estimateGasL1ToL2(l2Client, {
      chain: l2Client.chain,
      account: from,
      from,
      to,
      value: amount,
      data: '0x',
      gasPerPubdata: gasPerPubdataByte,
    })
  }
  const value = 0n
  const bridgeAddresses = await getDefaultBridgeAddresses(l2Client)
  const l1BridgeAddress = bridgeAddresses.sharedL1
  const l2BridgeAddress = bridgeAddresses.sharedL2
  const bridgeData = await encodeDefaultBridgeData(client, token)

  const calldata = encodeFunctionData({
    abi: parseAbi([
      'function finalizeDeposit(address _l1Sender, address _l2Receiver, address _l1Token, uint256 _amount, bytes _data)',
    ]),
    functionName: 'finalizeDeposit',
    args: [
      from,
      to,
      isAddressEqual(token, legacyEthAddress) ? ethAddressInContracts : token,
      amount,
      bridgeData,
    ],
  })

  return await estimateGasL1ToL2(l2Client, {
    chain: l2Client.chain,
    account: applyL1ToL2Alias(l1BridgeAddress),
    to: l2BridgeAddress,
    data: calldata,
    gasPerPubdata: gasPerPubdataByte,
    value,
  })
}

async function getL2GasLimitFromCustomBridge<
  chain extends Chain | undefined,
  chainL2 extends ChainEIP712 | undefined,
>(
  client: Client<Transport, chain>,
  l2Client: Client<Transport, chainL2>,
  from: Address,
  token: Address,
  amount: bigint,
  to: Address,
  gasPerPubdataByte: bigint,
  bridgeAddress: Address,
  customBridgeData?: Hex,
) {
  let customBridgeData_ = customBridgeData
  if (!customBridgeData_ || customBridgeData_ === '0x')
    customBridgeData_ = await encodeDefaultBridgeData(client, token)

  const l2BridgeAddress = await readContract(client, {
    address: token,
    abi: parseAbi([
      'function l2BridgeAddress(uint256 _chainId) view returns (address)',
    ]),
    functionName: 'l2BridgeAddress',
    args: [BigInt(l2Client.chain!.id)],
  })

  const calldata = encodeFunctionData({
    abi: parseAbi([
      'function finalizeDeposit(address _l1Sender, address _l2Receiver, address _l1Token, uint256 _amount, bytes _data)',
    ]),
    functionName: 'finalizeDeposit',
    args: [from, to, token, amount, customBridgeData_],
  })

  return await estimateGasL1ToL2(l2Client, {
    chain: l2Client.chain,
    account: from,
    from: applyL1ToL2Alias(bridgeAddress),
    to: l2BridgeAddress,
    data: calldata,
    gasPerPubdata: gasPerPubdataByte,
  })
}

async function encodeDefaultBridgeData<chain extends Chain | undefined>(
  client: Client<Transport, chain>,
  token: Address,
) {
  let token_ = token
  if (isAddressEqual(token, legacyEthAddress)) token_ = ethAddressInContracts
  let name = 'Ether'
  let symbol = 'ETH'
  let decimals = 18n
  if (!isAddressEqual(token_, ethAddressInContracts)) {
    name = await readContract(client, {
      address: token_,
      abi: erc20Abi,
      functionName: 'name',
      args: [],
    })
    symbol = await readContract(client, {
      address: token_,
      abi: erc20Abi,
      functionName: 'symbol',
      args: [],
    })
    decimals = BigInt(
      await readContract(client, {
        address: token_,
        abi: erc20Abi,
        functionName: 'decimals',
        args: [],
      }),
    )
  }

  const nameBytes = encodeAbiParameters([{ type: 'string' }], [name])
  const symbolBytes = encodeAbiParameters([{ type: 'string' }], [symbol])
  const decimalsBytes = encodeAbiParameters([{ type: 'uint256' }], [decimals])

  return encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }],
    [nameBytes, symbolBytes, decimalsBytes],
  )
}

function scaleGasLimit(gasLimit: bigint): bigint {
  return (gasLimit * BigInt(12)) / BigInt(10)
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
