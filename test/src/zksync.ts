import { type Address, parseAbi, parseAbiParameters } from 'abitype'
import { privateKeyToAccount } from '~viem/accounts/privateKeyToAccount.js'
import { readContract } from '~viem/actions/public/readContract.js'
import { writeContract } from '~viem/actions/wallet/writeContract.js'
import { type Client, createClient } from '~viem/clients/createClient.js'
import {
  http,
  type Chain,
  type ContractFunctionExecutionError,
  type Transport,
  createWalletClient,
  encodeAbiParameters,
  isAddressEqual,
  parseEther,
  publicActions,
} from '~viem/index.js'
import { wait } from '~viem/utils/wait.js'
import { getBaseTokenL1Address } from '~viem/zksync/actions/getBaseTokenL1Address.js'
import { ethAddressInContracts } from '~viem/zksync/constants/address.js'
import {
  deployContract,
  getBridgehubContractAddress,
  getDefaultBridgeAddresses,
  getL1Balance,
  getL2TokenAddress,
  sendTransaction,
  zksyncLocalCustomHyperchain,
  zksyncLocalHyperchain,
  zksyncLocalHyperchainL1,
  zksyncLocalNode,
} from '~viem/zksync/index.js'
import { erc20Abi } from './abis.js'
import { accounts } from './constants.js'

export const zksyncClientLocalNode = createClient({
  chain: zksyncLocalNode,
  transport: http(),
})

export const zksyncClientLocalNodeWithAccount = createClient({
  account: accounts[0].address,
  chain: zksyncLocalNode,
  transport: http(),
})

export function getZksyncMockProvider(
  request: ({
    method,
    params,
  }: { method: string; params?: unknown }) => Promise<any>,
) {
  return {
    on: () => null,
    removeListener: () => null,
    request: ({ method, params }: any) => request({ method, params }),
  }
}

export const mockedL1BatchNumber = '0x2012'

export const mockFeeValues = {
  gas_limit: '0x2803d',
  gas_per_pubdata_limit: '0x42',
  max_fee_per_gas: '0xee6b280',
  max_priority_fee_per_gas: '0x0',
}

export const mockAccountBalances = {
  '0x0000000000000000000000000000000000000000': '1000000000000000000',
  '0x0000000000000000000000000000000000000001': '2000000000000000000',
  '0x0000000000000000000000000000000000000002': '3500000000000000000',
}

export const mockBaseTokenL1Address =
  '0x0000000000000000000000000000000000000000'

export const mockBlockDetails = {
  number: 0,
  timestamp: 1713435780,
  l1BatchNumber: 0,
  l1TxCount: 2,
  l2TxCount: 3,
  status: 'verified',
  baseSystemContractsHashes: {
    bootloader:
      '0x010008bb22aea1e22373cb8d807b15c67eedd65523e9cba4cc556adfa504f7b8',
    default_aa:
      '0x010008bb22aea1e22373cb8d807b15c67eedd65523e9cba4cc556adfa504f7b8',
  },
  operatorAddress: '0xde03a0b5963f75f1c8485b355ff6d30f3093bde7',
  protocolVersion: 'Version19',
}

export const mockAddress = '0x173999892363ba18c9dc60f8c57152fc914bce89'

export const mockAddresses = {
  l1SharedDefaultBridge: '0x648afeaf09a3db988ac41b786001235bbdbc7640',
  l2SharedDefaultBridge: '0xfd61c893b903fa133908ce83dfef67c4c2350dd8',
  l1Erc20DefaultBridge: '0xbe270c78209cfda84310230aaa82e18936310b2e',
  l2Erc20DefaultBridge: '0xfc073319977e314f251eae6ae6be76b0b3baeecf',
  l1WethBridge: '0x5e6d086f5ec079adff4fb3774cdf3e8d6a34f7e9',
  l2WethBridge: '0x5e6d086f5ec079adff4fb3774cdf3e8d6a34f7e9',
}

export const mockRange = [0, 5]

export const mockDetails = {
  number: 0,
  timestamp: 0,
  l1TxCount: 0,
  l2TxCount: 0,
  l1BatchNumber: 0,
  status: 'verified',
  l1GasPrice: 0,
  l2FairGasPrice: 0,
  baseSystemContractsHashes: {
    bootloader:
      '0x010008bb22aea1e22373cb8d807b15c67eedd65523e9cba4cc556adfa504f7b8',
    default_aa:
      '0x01000563a7f32f1d97b4697f3bc996132433314b9b17351a7f7cd6073f618569',
  },
}

export const mockChainId = '0x9'

export const mockProofValues = {
  id: 112,
  proof: [
    '0x3d999d6a5bacdc5c8c01ad0917c1dca03c632fc486ac623a8857804374b0d1b1',
    '0xc3d03eebfd83049991ea3d3e358b6712e7aa2e2e63dc2d4b438987cec28ac8d0',
    '0xe3697c7f33c31a9b0f0aeb8542287d0d21e8c4cf82163d0c44c7a98aa11aa111',
    '0x199cc5812543ddceeddd0fc82807646a4899444240db2c0d2f20c3cceb5f51fa',
    '0xe4733f281f18ba3ea8775dd62d2fcd84011c8c938f16ea5790fd29a03bf8db89',
    '0x1798a1fd9c8fbb818c98cff190daa7cc10b6e5ac9716b4a2649f7c2ebcef2272',
    '0x66d7c5983afe44cf15ea8cf565b34c6c31ff0cb4dd744524f7842b942d08770d',
    '0xb04e5ee349086985f74b73971ce9dfe76bbed95c84906c5dffd96504e1e5396c',
    '0xac506ecb5465659b3a927143f6d724f91d8d9c4bdb2463aee111d9aa869874db',
    '0x124b05ec272cecd7538fdafe53b6628d31188ffb6f345139aac3c3c1fd2e470f',
    '0xc3be9cbd19304d84cca3d045e06b8db3acd68c304fc9cd4cbffe6d18036cb13f',
  ],
  root: '0x443ddd5b010069db588a5f21e9145f94a93dd8109c72cc70d79281f1c19db2c8',
}

export const mockMainContractAddress =
  '0x9fab5aec650f1ce6e35ec60a611af0a1345927c8'

export const mockRawBlockTransaction = [
  {
    common_data: {
      L1: {
        sender: '0xde03a0b5963f75f1c8485b355ff6d30f3093bde7',
        serialId: 0,
        deadlineBlock: 0,
        layer2TipFee: '0x0',
        fullFee: '0x0',
        maxFeePerGas: '0x1dcd6500',
        gasLimit: '0x44aa200',
        gasPerPubdataLimit: '0x320',
        opProcessingType: 'Common',
        priorityQueueType: 'Deque',
        ethHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ethBlock: 125,
        canonicalTxHash:
          '0x9376f805ccd40186a73672a4d0db064060956e70c4ae486ab205291986439343',
        toMint: '0x7fe5cf2bea0000',
        refundRecipient: '0xde03a0b5963f75f1c8485b355ff6d30f3093bde7',
      },
      L2: {
        nonce: 0,
        fee: {
          gas_limit: '0x2803d',
          gas_per_pubdata_limit: '0x42',
          max_fee_per_gas: '0xee6b280',
          max_priority_fee_per_gas: '0x0',
        },
        initiatorAddress: '0x000000000000000000000000000000000000800b',
        signature: new Uint8Array(),
        transactionType: 'ProtocolUpgrade',
        input: {
          hash: '0x',
          data: new Uint8Array(),
        },
        paymasterParams: {
          paymaster: '0x0a67078A35745947A37A552174aFe724D8180c25',
          paymasterInput: new Uint8Array(),
        },
      },
    },
    execute: {
      calldata:
        '0xef0e2ff4000000000000000000000000000000000000000000000000000000000000010e',
      contractAddress: '0x000000000000000000000000000000000000800b',
      factoryDeps: '0x',
      value: BigInt(0),
    },
    received_timestamp_ms: 1713436617435,
    raw_bytes: '',
  },
]

export const mockTestnetPaymasterAddress =
  '0x0a67078A35745947A37A552174aFe724D8180c25'

export const mockTransactionDetails = {
  isL1Originated: true,
  status: 'validated',
  fee: 10n,
  gasPerPubdata: 50000n,
  initiatorAddress: '0x000000000000000000000000000000000000800b',
  receivedAt: new Date(1713436617435),
}

export const mockedGasEstimation = 123456789n

export const mockRequestReturnData = async (method: string) => {
  if (method === 'zks_L1ChainId') return mockChainId
  if (method === 'zks_estimateFee') return mockFeeValues
  if (method === 'zks_getAllAccountBalances') return mockAccountBalances
  if (method === 'zks_getBaseTokenL1Address') return mockBaseTokenL1Address
  if (method === 'zks_getBlockDetails') return mockBlockDetails
  if (method === 'zks_getBridgehubContract') return mockAddress
  if (method === 'zks_getBridgeContracts') return mockAddresses
  if (method === 'zks_getL1BatchBlockRange') return mockRange
  if (method === 'zks_getL1BatchDetails') return mockDetails
  if (method === 'zks_getL2ToL1LogProof') return mockProofValues
  if (method === 'zks_getMainContract') return mockMainContractAddress
  if (method === 'zks_getRawBlockTransactions') return mockRawBlockTransaction
  if (method === 'zks_getTestnetPaymaster') return mockTestnetPaymasterAddress
  if (method === 'zks_getTransactionDetails') return mockTransactionDetails
  if (method === 'zks_L1BatchNumber') return mockedL1BatchNumber
  if (method === 'zks_estimateGasL1ToL2') return mockedGasEstimation
  return undefined
}

export function mockClientPublicActionsL2(client: any) {
  client.request = async ({ method }: any) => {
    return mockRequestReturnData(method)
  }
}

export async function getTokenBalance<chain extends Chain | undefined>(
  client: Client<Transport, chain>,
  token: Address,
  address: Address,
) {
  return await readContract(client, {
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })
}

export const daiL1 = '0x70a0F165d6f8054d0d0CF8dFd4DD2005f0AF6B55'
export const approvalToken = '0x2dc3685cA34163952CF4A5395b0039c00DFa851D'
export const paymaster = '0x0EEc6f45108B4b806e27B81d9002e162BD910670'

export const zksyncAccounts = [
  {
    address: '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049',
    privateKey:
      '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110',
  },
  {
    address: '0xa61464658AfeAf65CccaaFD3a512b69A83B77618',
    privateKey:
      '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3',
  },
] as const

const walletClient = createWalletClient({
  chain: zksyncLocalHyperchain,
  transport: http(),
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
}).extend(publicActions)

const walletClientCustom = createWalletClient({
  chain: zksyncLocalCustomHyperchain,
  transport: http(),
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
}).extend(publicActions)

const walletClientL1 = createWalletClient({
  chain: zksyncLocalHyperchainL1,
  transport: http(),
  account: privateKeyToAccount(zksyncAccounts[0].privateKey),
}).extend(publicActions)

/*
This function prepares the Hyperchain for testing and is intended to be used only once.
Subsequent executions do not modify the state of the chain. It is primarily designed to
be run in the beforeAll() function provided by the Vitest testing tool.

Since Vitest can run tests in parallel, this function is designed to handle parallel
execution. The first invocation that successfully sends a transaction to the chain
acts as the executor, fully executing the function. The remaining invocations act
as watchers, waiting for the executor to complete its execution.
 */
export async function setupHyperchain() {
  let executor = true

  // mint DAI tokens on L1 if they are not minted
  const daiL1Balance = await getL1Balance(walletClientL1, { token: daiL1 })
  try {
    if (!daiL1Balance) await mintTokensOnL1(daiL1)
  } catch (e) {
    const error = e as ContractFunctionExecutionError
    if (
      // the same transaction has already been sent to chain
      error.shortMessage.includes('already known') ||
      // some older transaction is still executing
      error.shortMessage ===
        'Nonce provided for the transaction is higher than the next one expected'
    ) {
      executor = false
      // wait for the other mint transaction to finish
      // the completion is resulted in balance change so monitor the balance
      for (let i = 0; i < 10; i++) {
        await wait(1000)
        if (daiL1Balance) break
      }
    }
  }

  const dai = await getL2TokenAddress(walletClient, { token: daiL1 })

  if (executor) {
    // send DAI tokens from L1 to L2 if they are not sent
    if (!(await walletClient.getCode({ address: dai })))
      await depositDaiOnHyperchain()
    // deploy paymaster and approval token
    if (!(await walletClient.getCode({ address: paymaster })))
      await deployPaymasterAndApprovalToken()
  } else {
    // wait for the executor to send DAI from L1 to L2
    for (let i = 0; i < 10; i++) {
      if (await walletClient.getCode({ address: dai })) break
      await wait(1000)
    }
    // wait for the executor to deploy paymaster and approval token
    for (let i = 0; i < 10; i++) {
      if (await walletClient.getCode({ address: paymaster })) break
      await wait(1000)
    }
  }
}

/*
This function prepares the Hyperchain for testing and is intended to be used only once.
Subsequent executions do not modify the state of the chain. It is primarily designed to
be run in the beforeAll() function provided by the Vitest testing tool.

Since Vitest can run tests in parallel, this function is designed to handle parallel
execution. The first invocation that successfully sends a transaction to the chain
acts as the executor, fully executing the function. The remaining invocations act
as watchers, waiting for the executor to complete its execution.
 */
export async function setupCustomHyperchain() {
  let executor = true

  // mint base token on L1 if they are not minted
  const baseToken = await getBaseTokenL1Address(walletClientCustom)
  const baseTokenL1Balance = await getL1Balance(walletClientL1, {
    token: baseToken,
  })
  try {
    if (!baseTokenL1Balance) await mintTokensOnL1(baseToken)
  } catch (e) {
    const error = e as ContractFunctionExecutionError
    if (
      // the same transaction has already been sent to chain
      error.shortMessage.includes('already known') ||
      // some older transaction is still executing
      error.shortMessage ===
        'Nonce provided for the transaction is higher than the next one expected'
    ) {
      executor = false
      // wait for the executor to mint tokens
      for (let i = 0; i < 10; i++) {
        await wait(1000)
        if (baseTokenL1Balance) break
      }
    }
  }

  const dai = await getL2TokenAddress(walletClientCustom, { token: daiL1 })

  if (executor) {
    // send base tokens from L1 to L2 if they are not sent
    const baseTokenBalance = await walletClientCustom.getBalance({
      address: walletClientCustom.account.address,
    })
    if (!baseTokenBalance) await depositBaseTokenOnCustomHyperchain()

    // send ETH tokens from L1 to L2 if they are not sent
    const eth = await getL2TokenAddress(walletClientCustom, {
      token: ethAddressInContracts,
    })
    if (!(await walletClientCustom.getCode({ address: eth })))
      await depositEthOnCustomHyperchain()

    // mint DAI tokens on L1 if they are not minted
    const daiL1Balance = await getL1Balance(walletClientL1, { token: daiL1 })
    if (!daiL1Balance) await mintTokensOnL1(daiL1)

    // send DAI tokens from L1 to L2 if they are not sent
    if (!(await walletClientCustom.getCode({ address: dai })))
      await depositDaiOnCustomHyperchain()

    // deploy paymaster and approval token
    if (!(await walletClientCustom.getCode({ address: paymaster })))
      await deployPaymasterAndApprovalTokenOnCustomChain()
  } else {
    // wait for the executor to send base tokens from L1 to L2
    for (let i = 0; i < 10; i++) {
      const baseTokenBalance = await walletClientCustom.getBalance({
        address: walletClientCustom.account.address,
      })
      if (baseTokenBalance) break
      await wait(1000)
    }

    // wait for the executor to send ETH tokens from L1 to L2
    for (let i = 0; i < 10; i++) {
      const eth = await getL2TokenAddress(walletClientCustom, {
        token: ethAddressInContracts,
      })
      if (await walletClientCustom.getCode({ address: eth })) break
      await wait(1000)
    }

    // wait for the executor to mint DAI tokens on L1
    for (let i = 0; i < 10; i++) {
      const daiL1Balance = await getL1Balance(walletClientL1, { token: daiL1 })
      if (daiL1Balance) break
      await wait(1000)
    }

    // wait for the executor to send DAI tokens from L1 to L2
    for (let i = 0; i < 10; i++) {
      if (await walletClientCustom.getCode({ address: dai })) break
      await wait(1000)
    }

    // wait for the executor to deploy paymaster and approval token
    for (let i = 0; i < 10; i++) {
      if (await walletClientCustom.getCode({ address: paymaster })) break
      await wait(1000)
    }
  }
}

export async function approveToken(
  chain: Chain,
  token: Address,
  spender: Address,
  amount: bigint,
) {
  const walletClient = createWalletClient({
    chain,
    transport: http(),
    account: privateKeyToAccount(zksyncAccounts[0].privateKey),
  }).extend(publicActions)

  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  })

  await walletClient.waitForTransactionReceipt({ hash })
}

async function mintTokensOnL1(l1Token: Address) {
  if (!isAddressEqual(l1Token, ethAddressInContracts)) {
    const hash = await walletClientL1.writeContract({
      address: l1Token,
      abi: parseAbi(['function mint(address to, uint256 amount) external']),
      functionName: 'mint',
      args: [walletClientL1.account.address, parseEther('20000')],
    })
    await walletClientL1.waitForTransactionReceipt({ hash })
  }
}

const bridgehubAbi = parseAbi([
  'function requestL2TransactionDirect((uint256 chainId, uint256 mintValue, address l2Contract, uint256 l2Value, bytes l2Calldata, uint256 l2GasLimit, uint256 l2GasPerPubdataByteLimit, bytes[] factoryDeps, address refundRecipient) _request) payable returns (bytes32 canonicalTxHash)',
  'function requestL2TransactionTwoBridges((uint256 chainId, uint256 mintValue, uint256 l2Value, uint256 l2GasLimit, uint256 l2GasPerPubdataByteLimit, address refundRecipient, address secondBridgeAddress, uint256 secondBridgeValue, bytes secondBridgeCalldata) _request) payable returns (bytes32 canonicalTxHash)',
])

async function depositDaiOnHyperchain() {
  const amount = 10_000_000_000_000_000_000_000n
  const bridgehub = await getBridgehubContractAddress(walletClient)
  const sharedL1Bridge = (await getDefaultBridgeAddresses(walletClient))
    .sharedL1
  await approveToken(zksyncLocalHyperchainL1, daiL1, sharedL1Bridge, amount)

  const hash = await walletClientL1.writeContract({
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionTwoBridges',
    args: [
      {
        chainId: zksyncLocalHyperchain.id,
        mintValue: 318_416_612_500_000n,
        l2Value: 0n,
        l2GasLimit: 1_184_806n,
        l2GasPerPubdataByteLimit: 800n,
        refundRecipient: walletClient.account.address,
        secondBridgeAddress: sharedL1Bridge,
        secondBridgeValue: 0n,
        secondBridgeCalldata: encodeAbiParameters(
          parseAbiParameters('address x, uint256 y, address z'),
          [daiL1, amount, walletClient.account.address],
        ),
      },
    ],
    value: 318_416_612_500_000n,
    maxFeePerGas: 1_500_000_001n,
    maxPriorityFeePerGas: 1_500_000_000n,
    gas: 385_904n,
  })
  const receipt = await walletClientL1.waitForTransactionReceipt({ hash })
  return receipt.status
}

async function depositBaseTokenOnCustomHyperchain() {
  const amount = 10_000_000_000_000_000_000_000n
  const mintValue = 10_000_000_112_327_018_750_000n
  const bridgehub = await getBridgehubContractAddress(walletClientCustom)
  const sharedL1Bridge = (await getDefaultBridgeAddresses(walletClientCustom))
    .sharedL1
  const baseToken = await getBaseTokenL1Address(walletClientCustom)
  await approveToken(
    zksyncLocalHyperchainL1,
    baseToken,
    sharedL1Bridge,
    mintValue,
  )

  const hash = await walletClientL1.writeContract({
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionDirect',
    args: [
      {
        chainId: zksyncLocalCustomHyperchain.id,
        mintValue,
        l2Contract: walletClientCustom.account.address,
        l2Value: amount,
        l2Calldata: '0x',
        l2GasLimit: 417_961n,
        l2GasPerPubdataByteLimit: 800n,
        factoryDeps: [],
        refundRecipient: walletClientCustom.account.address,
      },
    ],
    value: 0n,
    maxFeePerGas: 1_500_000_001n,
    maxPriorityFeePerGas: 1_500_000_000n,
    gas: 254_133n,
  })
  const receipt = await walletClientL1.waitForTransactionReceipt({ hash })
  return receipt.status
}

async function depositEthOnCustomHyperchain() {
  const amount = 10_000_000_000_000_000_000_000n
  const mintValue = 308_574_450_000_000n
  const bridgehub = await getBridgehubContractAddress(walletClientCustom)
  const sharedL1Bridge = (await getDefaultBridgeAddresses(walletClientCustom))
    .sharedL1
  const baseToken = await getBaseTokenL1Address(walletClientCustom)
  await approveToken(
    zksyncLocalHyperchainL1,
    baseToken,
    sharedL1Bridge,
    mintValue,
  )

  const hash = await walletClientL1.writeContract({
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionTwoBridges',
    args: [
      {
        chainId: zksyncLocalCustomHyperchain.id,
        mintValue,
        l2Value: 0n,
        l2GasLimit: 1_148_184n,
        l2GasPerPubdataByteLimit: 800n,
        refundRecipient: walletClientCustom.account.address,
        secondBridgeAddress: sharedL1Bridge,
        secondBridgeValue: amount,
        secondBridgeCalldata: encodeAbiParameters(
          parseAbiParameters('address x, uint256 y, address z'),
          [ethAddressInContracts, 0n, walletClientCustom.account.address],
        ),
      },
    ],
    value: amount,
    maxFeePerGas: 1_500_000_001n,
    maxPriorityFeePerGas: 1_500_000_000n,
    gas: 348_333n,
  })
  const receipt = await walletClientL1.waitForTransactionReceipt({ hash })
  return receipt.status
}

async function depositDaiOnCustomHyperchain() {
  const amount = 10_000_000_000_000_000_000_000n
  const mintValue = 318_416_612_500_000n
  const bridgehub = await getBridgehubContractAddress(walletClientCustom)
  const sharedL1Bridge = (await getDefaultBridgeAddresses(walletClientCustom))
    .sharedL1
  const baseToken = await getBaseTokenL1Address(walletClientCustom)
  await approveToken(
    zksyncLocalHyperchainL1,
    baseToken,
    sharedL1Bridge,
    mintValue,
  )
  await approveToken(zksyncLocalHyperchainL1, daiL1, sharedL1Bridge, amount)

  const hash = await walletClientL1.writeContract({
    address: bridgehub,
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionTwoBridges',
    args: [
      {
        chainId: zksyncLocalCustomHyperchain.id,
        mintValue,
        l2Value: 0n,
        l2GasLimit: 1_184_806n,
        l2GasPerPubdataByteLimit: 800n,
        refundRecipient: walletClientCustom.account.address,
        secondBridgeAddress: sharedL1Bridge,
        secondBridgeValue: 0n,
        secondBridgeCalldata: encodeAbiParameters(
          parseAbiParameters('address x, uint256 y, address z'),
          [daiL1, amount, walletClientCustom.account.address],
        ),
      },
    ],
    value: 0n,
    maxFeePerGas: 1_500_000_001n,
    maxPriorityFeePerGas: 1_500_000_000n,
    gas: 388_363n,
  })
  const receipt = await walletClientL1.waitForTransactionReceipt({ hash })
  return receipt.status
}

async function deployPaymasterAndApprovalToken() {
  const tokenHash = await deployContract(walletClient, {
    chain: walletClient.chain,
    deploymentType: 'create2',
    abi: tokenAbi,
    bytecode: tokenBytecode,
    args: ['Crown', 'Crown', 18],
    salt,
  })
  await walletClient.waitForTransactionReceipt({ hash: tokenHash })

  const mintHash = await writeContract(walletClient, {
    address: approvalToken,
    abi: tokenAbi,
    functionName: 'mint',
    args: [walletClient.account.address, 50n],
  })
  await walletClient.waitForTransactionReceipt({ hash: mintHash })

  const paymasterHash = await deployContract(walletClient, {
    chain: walletClient.chain,
    deploymentType: 'create2Account',
    abi: parseAbi(['constructor(address _erc20)']),
    bytecode: paymasterBytecode,
    args: [approvalToken],
    salt,
  })
  await walletClient.waitForTransactionReceipt({ hash: paymasterHash })

  const transferHash = await sendTransaction(walletClient, {
    from: walletClient.account.address,
    to: paymaster,
    value: parseEther('100'),
  })
  await walletClient.waitForTransactionReceipt({ hash: transferHash })
}

async function deployPaymasterAndApprovalTokenOnCustomChain() {
  const tokenHash = await deployContract(walletClientCustom, {
    chain: walletClientCustom.chain,
    deploymentType: 'create2',
    abi: tokenAbi,
    bytecode: tokenBytecode,
    args: ['Crown', 'Crown', 18],
    salt,
  })
  await walletClientCustom.waitForTransactionReceipt({ hash: tokenHash })

  const mintHash = await writeContract(walletClientCustom, {
    address: approvalToken,
    abi: tokenAbi,
    functionName: 'mint',
    args: [walletClientCustom.account.address, 50n],
  })
  await walletClientCustom.waitForTransactionReceipt({ hash: mintHash })

  const paymasterHash = await deployContract(walletClientCustom, {
    chain: walletClientCustom.chain,
    deploymentType: 'create2Account',
    abi: parseAbi(['constructor(address _erc20)']),
    bytecode: paymasterBytecode,
    args: [approvalToken],
    salt,
  })
  await walletClientCustom.waitForTransactionReceipt({ hash: paymasterHash })

  const transferHash = await sendTransaction(walletClientCustom, {
    from: walletClientCustom.account.address,
    to: paymaster,
    value: parseEther('100'),
  })
  await walletClientCustom.waitForTransactionReceipt({ hash: transferHash })
}

export const salt =
  '0x293328ad84b118194c65a0dc0defdb6483740d3163fd99b260907e15f2e2f642'
const tokenAbi = parseAbi([
  'constructor(string name_, string symbol_, uint8 decimals_)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) nonpayable returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address _to, uint256 _amount) nonpayable returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) nonpayable returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) nonpayable returns (bool)',
])
const tokenBytecode =
  '0x0002000000000002000900000000000200010000000103550000006001100270000001980010019d0000008001000039000000400010043f0000000101200190000000340000c13d0000000001000031000000040110008c000003670000413d0000000101000367000000000101043b000000e0011002700000019d0210009c000001420000213d000001a50210009c000001720000213d000001a90210009c000001fd0000613d000001aa0210009c000002210000613d000001ab0110009c000003670000c13d0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000000310004c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d0000000201000039000000000101041a000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d00000000020000310000001f01200039000000200a00008a0000000004a1016f000000400100043d0000000003140019000000000443004b00000000040000190000000104004039000001990530009c000003c90000213d0000000104400190000003c90000c13d000000400030043f0000001f0320018f00000001040003670000000505200272000000520000613d000000000600001900000005076002100000000008710019000000000774034f000000000707043b00000000007804350000000106600039000000000756004b0000004a0000413d000000000630004c000000610000613d0000000505500210000000000454034f00000000055100190000000303300210000000000605043300000000063601cf000000000636022f000000000404043b0000010003300089000000000434022f00000000033401cf000000000363019f00000000003504350000019a03000041000000600420008c000000000400001900000000040340190000019a05200197000000000650004c000000000300a0190000019a0550009c000000000304c019000000000330004c000003670000c13d0000000034010434000001990540009c000003670000213d000000000221001900000000041400190000001f054000390000019a06000041000000000725004b000000000700001900000000070680190000019a055001970000019a08200197000000000985004b0000000006008019000000000585013f0000019a0550009c00000000050700190000000005066019000000000550004c000003670000c13d0000000005040433000001990650009c000003c90000213d0000003f065000390000000006a6016f000000400b00043d00000000066b00190000000007b6004b00000000070000190000000107004039000001990860009c000003c90000213d0000000107700190000003c90000c13d000000400060043f000000000c5b043600000020065000390000000007460019000000000727004b000003670000213d000000000750004c0000009e0000613d000000000700001900000020077000390000000008b70019000000000947001900000000090904330000000000980435000000000857004b000000970000413d00000000046b001900000000000404350000000003030433000001990430009c000003670000213d00000000031300190000001f043000390000019a05000041000000000624004b000000000600001900000000060580190000019a044001970000019a07200197000000000874004b0000000005008019000000000474013f0000019a0440009c00000000040600190000000004056019000000000440004c000003670000c13d0000000004030433000001990540009c000003c90000213d0000003f054000390000000005a5016f000000400800043d0000000005580019000000000685004b00000000060000190000000106004039000001990750009c000003c90000213d0000000106600190000003c90000c13d000000400050043f0000000005480436000800000005001d00000020054000390000000006350019000000000226004b000003670000213d00060000000c001d00090000000b001d00070000000a001d000000000240004c000000d50000613d000000000200001900000020022000390000000006820019000000000732001900000000070704330000000000760435000000000642004b000000ce0000413d0000000002580019000000000002043500000040011000390000000001010433000500000001001d000000ff0110008c0000000901000029000003670000213d0000000001010433000400000001001d000001990110009c000003c90000213d000100000008001d0000000301000039000300000001001d000000000101041a000000010210019000000001011002700000007f0310018f0000000001036019000200000001001d0000001f0110008c00000000010000190000000101002039000000010110018f000000000112004b0000021b0000c13d0000000201000029000000200110008c000001100000413d0000000301000029000000000010043500000198010000410000000002000414000001980320009c0000000001024019000000c0011002100000019b011001c70000801002000039065b06560000040f0000000102200190000003670000613d00000004030000290000001f023000390000000502200270000000200330008c0000000002004019000000000301043b00000002010000290000001f01100039000000050110027000000000011300190000000002230019000000000312004b000001100000813d000000000002041b0000000102200039000000000312004b0000010c0000413d00000004010000290000001f0110008c000004990000a13d0000000301000029000000000010043500000198010000410000000002000414000001980320009c0000000001024019000000c0011002100000019b011001c70000801002000039065b06560000040f000000010220019000000007020000290000000906000029000003670000613d000000040300002900000000032301700000002002000039000000000101043b000001300000613d0000002002000039000000000400001900000000056200190000000005050433000000000051041b000000200220003900000001011000390000002004400039000000000534004b000001280000413d0000000404000029000000000343004b0000013e0000813d00000004030000290000000303300210000000f80330018f000000010400008a000000000334022f000000000343013f000000090400002900000000024200190000000002020433000000000232016f000000000021041b0000000401000029000000010110021000000001011001bf000004a70000013d0000019e0210009c000001c60000213d000001a20210009c000002440000613d000001a30210009c000002700000613d000001a40110009c000003670000c13d0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000000310004c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d0000000405000039000000000405041a000000010640019000000001014002700000007f0210018f00000000010260190000001f0210008c00000000020000190000000102002039000000000224013f00000001022001900000021b0000c13d000000400200043d0000000003120436000000000660004c000003800000c13d000001000500008a000000000454016f0000000000430435000000000110004c000000200400003900000000040060190000038d0000013d000001a60210009c000002940000613d000001a70210009c000002e30000613d000001a80110009c000003670000c13d0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000004010000390000000101100367000000000101043b000900000001001d000001ac0110009c000003670000213d0000000001000411000700000001001d00000000001004350000000101000039000800000001001d000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000003670000613d000000000101043b00000009020000290000000000200435000000200010043f00000024010000390000000101100367000000000101043b000600000001001d00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000003670000613d000000000101043b000000000101041a00000006020000290000000003210019000000000113004b000000000100001900000001010040390000000101100190000003ae0000c13d00000007010000290000000902000029065b05ea0000040f000000400100043d000000080200002900000000002104350000019802000041000001980310009c00000000010280190000004001100210000001ad011001c70000065c0001042e0000019f0210009c000002ff0000613d000001a00210009c000003510000613d000001a10110009c000003670000c13d0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001020003670000000401200370000000000101043b000001ac0310009c000003670000213d0000002402200370000000000302043b000001ac0230009c000003670000213d00000000001004350000000101000039000000200010043f0000004002000039000900000002001d0000000001000019000800000003001d065b052b0000040f00000008020000290000000000200435000000200010043f00000000010000190000000902000029065b052b0000040f000000000101041a000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000000310004c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d0000000303000039000000000203041a000000010420019000000001012002700000007f0510018f000000000601001900000000060560190000001f0560008c00000000050000190000000105002039000000000552013f0000000105500190000003690000613d000001b70100004100000000001004350000002201000039000000040010043f000001b8010000410000065d000104300000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001010003670000000402100370000000000202043b000001ac0320009c000003670000213d0000002401100370000000000301043b0000000001000411065b05ea0000040f0000000101000039000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001010003670000000402100370000000000402043b000001ac0240009c000003670000213d0000002401100370000000000501043b000000000140004c000003a60000c13d000000400100043d0000004402100039000001b503000041000000000032043500000024021000390000001f030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b6011001c70000065d000104300000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000200310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000004010000390000000101100367000000000101043b000001ac0210009c000003670000213d0000000000100435000000200000043f00000040020000390000000001000019065b052b0000040f000000000101041a000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000600310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001010003670000000402100370000000000402043b000001ac0240009c000003670000213d0000002402100370000000000202043b000900000002001d000001ac0220009c000003670000213d0000004401100370000000000101043b000700000001001d00000000004004350000000101000039000600000001001d000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039000800000004001d065b06560000040f0000000102200190000003670000613d000000000101043b0000000002000411000500000002001d0000000000200435000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f00000008030000290000000102200190000003670000613d000000000101043b000000000201041a000000010100008a000000000112004b0000041c0000c13d000000000103001900000009020000290000000703000029065b05570000040f000000400100043d000000060200002900000000002104350000019802000041000001980310009c00000000010280190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000000310004c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d0000000501000039000000000101041a000000ff0110018f000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001010003670000000402100370000000000202043b000900000002001d000001ac0220009c000003670000213d0000002401100370000000000101043b000800000001001d0000000001000411000600000001001d00000000001004350000000101000039000700000001001d000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000003670000613d000000000101043b00000009020000290000000000200435000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000003670000613d000000000101043b000000000101041a0000000803000029000000000231004b0000040f0000813d000000400100043d0000006402100039000001af0300004100000000003204350000004402100039000001b0030000410000000000320435000000240210003900000025030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d000104300000000001000416000000000110004c000003670000c13d000000040100008a00000000011000310000019a02000041000000400310008c000000000300001900000000030240190000019a01100197000000000410004c000000000200a0190000019a0110009c00000000010300190000000001026019000000000110004c000003670000c13d00000001010003670000000402100370000000000202043b000001ac0320009c000003730000a13d00000000010000190000065d00010430000000800060043f000000000440004c000003b40000c13d000001000300008a000000000232016f000000a00020043f000000000160004c000000c001000039000000a001006039000003c30000013d0000002401100370000000000301043b0000000001000411065b05570000040f0000000101000039000000400200043d00000000001204350000019801000041000001980320009c00000000010240190000004001100210000001ad011001c70000065c0001042e0000000000500435000000000410004c00000000040000190000038d0000613d000001b30500004100000000040000190000000006430019000000000705041a000000000076043500000001055000390000002004400039000000000614004b000003860000413d0000003f01400039000000200300008a000000000331016f0000000001230019000000000331004b00000000040000190000000104004039000001990310009c000003c90000213d0000000103400190000003c90000c13d000000400010043f000900000001001d065b05410000040f000000090400002900000000014100490000019802000041000001980310009c0000000001028019000001980340009c000000000204401900000040022002100000006001100210000000000121019f0000065c0001042e0000000201000039000000000301041a0000000002530019000000000332004b000000000300001900000001030040390000000103300190000003de0000613d000001b70100004100000000001004350000001101000039000000040010043f000001b8010000410000065d000104300000000000300435000000a001000039000000000260004c000003cf0000613d000001bf0200004100000000040000190000000003040019000000000402041a000000a005300039000000000045043500000001022000390000002004300039000000000564004b000003ba0000413d000000c0013000390000001f01100039000000200200008a000000000121016f000001c002100041000001c10220009c000003cf0000813d000001b70100004100000000001004350000004101000039000000040010043f000001b8010000410000065d00010430000900000001001d000000400010043f0000008002000039065b05410000040f000000090400002900000000014100490000019802000041000001980310009c0000000001028019000001980340009c000000000204401900000040022002100000006001100210000000000121019f0000065c0001042e000800000005001d000000000021041b0000000000400435000000200000043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039000900000004001d065b06560000040f00000009060000290000000102200190000003670000613d000000000101043b000000000201041a00000008030000290000000002320019000000000021041b000000400100043d000000000031043500000198020000410000000003000414000001980430009c0000000003028019000001980410009c00000000010280190000004001100210000000c002300210000000000112019f0000019b011001c70000800d020000390000000303000039000001b4040000410000000005000019065b06510000040f0000000101200190000003670000613d000000400100043d000000010200003900000000002104350000019802000041000001980310009c00000000010280190000004001100210000001ad011001c70000065c0001042e000000000331004900000006010000290000000902000029065b05ea0000040f000000400100043d000000070200002900000000002104350000019802000041000001980310009c00000000010280190000004001100210000001ad011001c70000065c0001042e0000000701000029000000000112004b000004310000813d000000400100043d0000004402100039000001be03000041000000000032043500000024021000390000001d030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b6011001c70000065d00010430000400000002001d000000000130004c000004490000c13d000000400100043d0000006402100039000001bc0300004100000000003204350000004402100039000001bd030000410000000000320435000000240210003900000024030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d000104300000000501000029000001ac01100198000500000001001d000004620000c13d000000400100043d0000006402100039000001ba0300004100000000003204350000004402100039000001bb030000410000000000320435000000240210003900000022030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d00010430000000080100002900000000001004350000000601000029000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000003670000613d000000000101043b00000005020000290000000000200435000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f00000004030000290000000102200190000003670000613d00000007020000290000000002230049000000000101043b000000000021041b000000400100043d000000000021043500000198020000410000000003000414000001980430009c0000000003028019000001980410009c00000000010280190000004001100210000000c002300210000000000112019f0000019b011001c70000800d020000390000000303000039000001b90400004100000008050000290000000506000029065b06510000040f00000008030000290000000101200190000002d60000c13d000003670000013d0000000401000029000000000110004c00000000010000190000049f0000613d0000000601000029000000000101043300000004040000290000000302400210000000010300008a000000000223022f000000000232013f000000000121016f0000000102400210000000000121019f0000000302000029000000000012041b00000001010000290000000001010433000900000001001d000001990110009c000003c90000213d0000000401000039000600000001001d000000000101041a000000010210019000000001021002700000007f0320018f0000000002036019000400000002001d0000001f0220008c00000000020000190000000102002039000000000121013f00000001011001900000021b0000c13d0000000401000029000000200110008c000004dc0000413d0000000601000029000000000010043500000198010000410000000002000414000001980320009c0000000001024019000000c0011002100000019b011001c70000801002000039065b06560000040f0000000102200190000003670000613d00000009030000290000001f023000390000000502200270000000200330008c0000000002004019000000000301043b00000004010000290000001f01100039000000050110027000000000011300190000000002230019000000000312004b000004dc0000813d000000000002041b0000000102200039000000000312004b000004d80000413d00000009010000290000001f0110008c0000050e0000a13d0000000601000029000000000010043500000198010000410000000002000414000001980320009c0000000001024019000000c0011002100000019b011001c70000801002000039065b06560000040f000000010220019000000007020000290000000106000029000003670000613d000000090300002900000000032301700000002002000039000000000101043b000004fc0000613d0000002002000039000000000400001900000000056200190000000005050433000000000051041b000000200220003900000001011000390000002004400039000000000534004b000004f40000413d0000000904000029000000000343004b0000050a0000813d00000009030000290000000303300210000000f80330018f000000010400008a000000000334022f000000000343013f000000010400002900000000024200190000000002020433000000000232016f000000000021041b0000000101000039000000090200002900000001022002100000051b0000013d0000000901000029000000000110004c0000000001000019000005140000613d0000000801000029000000000101043300000009040000290000000302400210000000010300008a000000000223022f000000000232013f000000000221016f0000000101400210000000000112019f0000000602000029000000000012041b0000000501000039000000000201041a000001000300008a000000000232016f0000000503000029000000ff0330018f000000000232019f000000000021041b0000002001000039000001000010044300000120000004430000019c010000410000065c0001042e0000019803000041000001980410009c00000000010380190000004001100210000001980420009c00000000020380190000006002200210000000000112019f0000000002000414000001980420009c0000000002038019000000c002200210000000000112019f000001c2011001c70000801002000039065b06560000040f00000001022001900000053f0000613d000000000101043b000000000001042d00000000010000190000065d0001043000000020030000390000000004310436000000000302043300000000003404350000004001100039000000000430004c000005500000613d000000000400001900000000054100190000002004400039000000000624001900000000060604330000000000650435000000000534004b000005490000413d000000000231001900000000000204350000001f02300039000000200300008a000000000232016f0000000001210019000000000001042d0004000000000002000400000003001d000001ac01100198000005ab0000613d000001ac02200198000200000002001d000005c00000613d000300000001001d0000000000100435000000200000043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000005a90000613d000000000101043b000000000201041a0000000401000029000100000002001d000000000112004b000005d50000413d00000003010000290000000000100435000000200000043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000005a90000613d000000040200002900000001030000290000000002230049000000000101043b000000000021041b0000000201000029000000000010043500000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f0000000102200190000005a90000613d000000000101043b000000000201041a00000004030000290000000002320019000000000021041b000000400100043d000000000031043500000198020000410000000003000414000001980430009c0000000003028019000001980410009c00000000010280190000004001100210000000c002300210000000000112019f0000019b011001c70000800d020000390000000303000039000001b40400004100000003050000290000000206000029065b06510000040f0000000101200190000005a90000613d000000000001042d00000000010000190000065d00010430000000400100043d0000006402100039000001c70300004100000000003204350000004402100039000001c8030000410000000000320435000000240210003900000025030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d00010430000000400100043d0000006402100039000001c50300004100000000003204350000004402100039000001c6030000410000000000320435000000240210003900000023030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d00010430000000400100043d0000006402100039000001c30300004100000000003204350000004402100039000001c4030000410000000000320435000000240210003900000026030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d000104300003000000000002000001ac01100198000006270000613d000200000003001d000001ac02200198000300000002001d0000063c0000613d000100000001001d00000000001004350000000101000039000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f00000001022001900000000304000029000006250000613d000000000101043b0000000000400435000000200010043f00000198010000410000000002000414000001980320009c0000000001024019000000c001100210000001ae011001c70000801002000039065b06560000040f00000003060000290000000102200190000006250000613d000000000101043b0000000202000029000000000021041b000000400100043d000000000021043500000198020000410000000003000414000001980430009c0000000003028019000001980410009c00000000010280190000004001100210000000c002300210000000000112019f0000019b011001c70000800d020000390000000303000039000001b9040000410000000105000029065b06510000040f0000000101200190000006250000613d000000000001042d00000000010000190000065d00010430000000400100043d0000006402100039000001bc0300004100000000003204350000004402100039000001bd030000410000000000320435000000240210003900000024030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d00010430000000400100043d0000006402100039000001ba0300004100000000003204350000004402100039000001bb030000410000000000320435000000240210003900000022030000390000000000320435000001b10200004100000000002104350000000402100039000000200300003900000000003204350000019802000041000001980310009c00000000010280190000004001100210000001b2011001c70000065d0001043000000654002104210000000102000039000000000001042d0000000002000019000000000001042d00000659002104230000000102000039000000000001042d0000000002000019000000000001042d0000065b000004320000065c0001042e0000065d000104300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffff000000000000000000000000000000000000000000000000ffffffffffffffff8000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000002000000000000000000000000000000002000000000000000000000000000000400000010000000000000000000000000000000000000000000000000000000000000000000000000040c10f1800000000000000000000000000000000000000000000000000000000a457c2d600000000000000000000000000000000000000000000000000000000a457c2d700000000000000000000000000000000000000000000000000000000a9059cbb00000000000000000000000000000000000000000000000000000000dd62ed3e0000000000000000000000000000000000000000000000000000000040c10f190000000000000000000000000000000000000000000000000000000070a082310000000000000000000000000000000000000000000000000000000095d89b410000000000000000000000000000000000000000000000000000000023b872dc0000000000000000000000000000000000000000000000000000000023b872dd00000000000000000000000000000000000000000000000000000000313ce56700000000000000000000000000000000000000000000000000000000395093510000000000000000000000000000000000000000000000000000000006fdde0300000000000000000000000000000000000000000000000000000000095ea7b30000000000000000000000000000000000000000000000000000000018160ddd000000000000000000000000ffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000200000000000000000000000000200000000000000000000000000000000000040000000000000000000000000207a65726f00000000000000000000000000000000000000000000000000000045524332303a2064656372656173656420616c6c6f77616e63652062656c6f7708c379a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000840000000000000000000000008a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19bddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef45524332303a206d696e7420746f20746865207a65726f20616464726573730000000000000000000000000000000000000000640000000000000000000000004e487b710000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000240000000000000000000000008c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925737300000000000000000000000000000000000000000000000000000000000045524332303a20617070726f766520746f20746865207a65726f206164647265726573730000000000000000000000000000000000000000000000000000000045524332303a20617070726f76652066726f6d20746865207a65726f2061646445524332303a20696e73756666696369656e7420616c6c6f77616e6365000000c2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85bffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000ffffffffffffffffffffffffffffffffffffffffffffffff00000000000000800200000000000000000000000000000000000000000000000000000000000000616c616e6365000000000000000000000000000000000000000000000000000045524332303a207472616e7366657220616d6f756e7420657863656564732062657373000000000000000000000000000000000000000000000000000000000045524332303a207472616e7366657220746f20746865207a65726f2061646472647265737300000000000000000000000000000000000000000000000000000045524332303a207472616e736665722066726f6d20746865207a65726f206164000000000000000000000000000000000000000000000000000000000000000018469939d00da7016fd24775544e09a6a1ad29697146a060aa4a0baa144c2ede'
const paymasterBytecode =
  '0x0004000000000002000700000000000200000000030100190000006003300270000000ed0430019700030000004103550002000000010355000000ed0030019d000100000000001f0000000101200190000000340000c13d0000008001000039000000400010043f0000000002000031000000040120008c000000430000413d0000000201000367000000000301043b000000e003300270000000f30430009c0000007c0000613d000000f40430009c000000d40000613d000000f50130009c000000fc0000c13d0000000001000416000000000110004c000000fc0000c13d000000040100008a0000000001100031000000ef02000041000000000310004c00000000030000190000000003024019000000ef01100197000000000410004c000000000200a019000000ef0110009c00000000010300190000000001026019000000000110004c000000fc0000c13d000000000100041a000000f001100197000000400200043d0000000000120435000000ed01000041000000ed0320009c00000000010240190000004001100210000000f6011001c7000003ae0001042e0000000001000416000000000110004c000000fc0000c13d00000000010000310000009f02100039000000200300008a000000000232016f000000ee0320009c000000470000413d000001040100004100000000001004350000004101000039000000040010043f0000010501000041000003af00010430000000000120004c000000fc0000c13d0000000001000019000003ae0001042e000000400020043f0000001f0210018f00000002030003670000000504100272000000550000613d00000000050000190000000506500210000000000763034f000000000707043b000000800660003900000000007604350000000105500039000000000645004b0000004d0000413d000000000520004c000000640000613d0000000504400210000000000343034f00000003022002100000008004400039000000000504043300000000052501cf000000000525022f000000000303043b0000010002200089000000000323022f00000000022301cf000000000252019f0000000000240435000000ef02000041000000200310008c00000000030000190000000003024019000000ef01100197000000000410004c000000000200a019000000ef0110009c00000000010300190000000001026019000000000110004c000000fc0000c13d000000800100043d000000f00210009c000000fc0000213d000000000200041a000000f102200197000000000112019f000000000010041b000000200100003900000100001004430000012000000443000000f201000041000003ae0001042e000000040320008a000000ef04000041000000600530008c00000000050000190000000005044019000000ef03300197000000000630004c000000000400a019000000ef0330009c00000000030500190000000003046019000000000330004c000000fc0000c13d0000004403100370000000000a03043b000000f703a0009c000000fc0000213d0000000403a000390000000004320049000000ef05000041000002600640008c00000000060000190000000006054019000000ef04400197000000000740004c000000000500a019000000ef0440009c00000000040600190000000004056019000000000440004c000000fc0000c13d0000000004000411000080010440008c000000fe0000c13d0000022404a00039000000000441034f0000000005a20049000000230550008a000000000404043b000000ef06000041000000000754004b00000000070000190000000007068019000000ef05500197000000ef08400197000000000958004b0000000006008019000000000558013f000000ef0550009c00000000050700190000000005066019000000000550004c000000fc0000c13d0000000003340019000000000431034f000000000404043b000000f70540009c000000fc0000213d00000000054200490000002002300039000000ef06000041000000000752004b00000000070000190000000007062019000000ef05500197000000ef08200197000000000958004b0000000006008019000000000558013f000000ef0550009c00000000050700190000000005066019000000000550004c000000fc0000c13d000000030540008c000001220000213d000000f801000041000000800010043f0000002001000039000000840010043f0000003a01000039000000a40010043f0000010a01000041000000c40010043f0000010b01000041000000e40010043f000000fb01000041000003af00010430000000040320008a000000ef04000041000000c00530008c00000000050000190000000005044019000000ef06300197000000000760004c000000000400a019000000ef0660009c000000000405c019000000000440004c000000fc0000c13d0000000404100370000000000404043b000000f70540009c000000fc0000213d0000002305400039000000ef06000041000000000725004b00000000070000190000000007068019000000ef08200197000000ef05500197000000000985004b0000000006008019000000000585013f000000ef0550009c00000000050700190000000005066019000000000550004c000000fc0000c13d0000000405400039000000000551034f000000000505043b000000f70650009c000000fc0000213d00000000045400190000002404400039000000000224004b0000010a0000a13d0000000001000019000003af00010430000000f801000041000000800010043f0000002001000039000000840010043f0000002401000039000000a40010043f000000f901000041000000c40010043f000000fa01000041000000e40010043f000000fb01000041000003af000104300000002402100370000000000202043b000000f70420009c000000fc0000213d0000000002230049000000ef03000041000002600420008c00000000040000190000000004034019000000ef02200197000000000520004c000000000300a019000000ef0220009c00000000020400190000000002036019000000000220004c000000fc0000c13d0000008401100370000000000101043b000000010110008c000000fc0000213d03ad038a0000040f0000000001000019000003ae0001042e000000000221034f000000000202043b000000fc02200197000000fd0220009c000001970000c13d000000040240008a000000600420008c000000fc0000413d0000002404300039000000000541034f000000000505043b000700000005001d000000f00550009c000000fc0000213d0000006405300039000000000551034f0000004403300039000000000331034f000000000303043b000600000003001d000000000305043b000000f70530009c000000fc0000213d000000000242001900000000034300190000001f04300039000000ef05000041000000000624004b00000000060000190000000006058019000000ef04400197000000ef07200197000000000874004b0000000005008019000000000474013f000000ef0440009c00000000040600190000000004056019000000000440004c000000fc0000c13d00050000000a001d000000000131034f000000000101043b000000f70410009c0000003d0000213d000000bf04100039000000200500008a000000000454016f000000f70540009c0000003d0000213d000000400040043f000000800010043f00000020033000390000000004310019000000000224004b000000fc0000213d0000001f0210018f00000002033003670000000504100272000001670000613d00000000050000190000000506500210000000000763034f000000000707043b000000a00660003900000000007604350000000105500039000000000645004b0000015f0000413d000000000520004c000001760000613d0000000504400210000000000343034f0000000302200210000000a004400039000000000504043300000000052501cf000000000525022f000000000303043b0000010002200089000000000323022f00000000022301cf000000000252019f0000000000240435000000a0011000390000000000010435000000000100041a000000f0011001970000000702000029000000000112004b000001a10000c13d000000050100002900000024011000390000000201100367000000000101043b000000400400043d000001020200004100000000002404350000000002000410000000f0032001970000002402400039000100000003001d0000000000320435000000f002100197000400000004001d0000000401400039000200000002001d000000000021043500000000010004140000000702000029000000040220008c000001b30000c13d0000000103000031000000200130008c00000020040000390000000004034019000001e60000013d000000f801000041000000800010043f0000002001000039000000840010043f0000001a01000039000000a40010043f000000fe01000041000000c40010043f000000ff01000041000003af00010430000000400100043d00000044021000390000010003000041000000000032043500000024021000390000000d030000390000000000320435000000f8020000410000000000210435000000040210003900000020030000390000000000320435000000ed02000041000000ed0310009c0000000001028019000000400110021000000101011001c7000003af00010430000000ed02000041000000ed0310009c00000000010280190000000404000029000000ed0340009c00000000020440190000004002200210000000c001100210000000000121019f00000103011001c7000000070200002903ad03a80000040f000000040a00002900000000030100190000006003300270000000ed03300197000000200430008c000000200400003900000000040340190000001f0540018f0000000506400272000001d20000613d0000000007000019000000050870021000000000098a0019000000000881034f000000000808043b00000000008904350000000107700039000000000867004b000001ca0000413d000000000750004c000001e20000613d0000000506600210000000000761034f000000040800002900000000066800190000000305500210000000000806043300000000085801cf000000000858022f000000000707043b0000010005500089000000000757022f00000000055701cf000000000585019f0000000000560435000100000003001f000300000001035500000001022001900000020c0000613d0000001f01400039000000600110018f00000004020000290000000002210019000000000112004b00000000010000190000000101004039000300000002001d000000f70220009c0000003d0000213d00000001011001900000003d0000c13d0000000301000029000000400010043f000000200130008c000000fc0000413d00000004010000290000000001010433000000000110004c000002320000c13d0000000303000029000000440130003900000109020000410000000000210435000000240130003900000015020000390000000000210435000000f8010000410000000000130435000000040130003900000020020000390000000000210435000000ed01000041000000ed0230009c0000000001034019000000400110021000000101011001c7000003af00010430000000400200043d0000001f0430018f0000000503300272000002190000613d000000000500001900000005065002100000000007620019000000000661034f000000000606043b00000000006704350000000105500039000000000635004b000002110000413d000000000540004c000002280000613d0000000503300210000000000131034f00000000033200190000000304400210000000000503043300000000054501cf000000000545022f000000000101043b0000010004400089000000000141022f00000000014101cf000000000151019f0000000000130435000000ed010000410000000103000031000000ed0430009c0000000003018019000000ed0420009c000000000102401900000040011002100000006002300210000000000112019f000003af00010430000000050400002900000064014000390000000202000367000000000312034f000000a401400039000000000112034f000000000101043b000000000203043b00000000341200a9000500000004001d000000000320004c000002420000613d000000050300002900000000322300d9000000000112004b000002c10000c13d00000003030000290000004401300039000000060200002900000000002104350000002401300039000000010200002900000000002104350000010601000041000000000013043500000004013000390000000202000029000000000021043500000000010004140000000702000029000000040220008c000002570000c13d0000000103000031000000200130008c000000200400003900000000040340190000028a0000013d000000ed02000041000000ed0310009c00000000010280190000000304000029000000ed0340009c00000000020440190000004002200210000000c001100210000000000121019f00000101011001c7000000070200002903ad03a30000040f000000030a00002900000000030100190000006003300270000000ed03300197000000200430008c000000200400003900000000040340190000001f0540018f0000000506400272000002760000613d0000000007000019000000050870021000000000098a0019000000000881034f000000000808043b00000000008904350000000107700039000000000867004b0000026e0000413d000000000750004c000002860000613d0000000506600210000000000761034f000000030800002900000000066800190000000305500210000000000806043300000000085801cf000000000858022f000000000707043b0000010005500089000000000757022f00000000055701cf000000000585019f0000000000560435000100000003001f00030000000103550000000101200190000002c70000613d0000001f01400039000000600110018f00000003020000290000000001210019000000f70210009c0000003d0000213d000000400010043f000000200130008c000000fc0000413d00000003010000290000000001010433000000000210004c0000000002000019000000010200c039000000000121004b000000fc0000c13d000000ed03000041000700000003001d0000000001000414000000ed0210009c0000000001038019000000c00110021000000108021001c70000000503000029000000000430004c000000000102c019000080090200003900008001020060390000800104000039000000000500001903ad03a30000040f000600000002001d00000000020100190000006002200270000100ed0020019d000300000001035503ad032b0000040f0000000601000029000000010110018f03ad036f0000040f000000400100043d000600000001001d03ad03110000040f00000006040000290000000001410049000000ed0210009c00000007030000290000000001038019000000ed0240009c0000000002030019000000000204401900000040022002100000006001100210000000000121019f000003ae0001042e000001040100004100000000001004350000001101000039000000040010043f0000010501000041000003af000104300000006001000039000000000230004c000002f40000613d0000003f013000390000010702100197000000400100043d0000000002210019000000000412004b00000000040000190000000104004039000000f70520009c0000003d0000213d00000001044001900000003d0000c13d000000400020043f0000000002310436000000030300036700000001050000310000001f0450018f0000000505500272000002e50000613d000000000600001900000005076002100000000008720019000000000773034f000000000707043b00000000007804350000000106600039000000000756004b000002dd0000413d000000000640004c000002f40000613d0000000505500210000000000353034f00000000025200190000000304400210000000000502043300000000054501cf000000000545022f000000000303043b0000010004400089000000000343022f00000000034301cf000000000353019f00000000003204350000000021010434000000050310008c000003000000413d000000ed03000041000000ed0420009c0000000002038019000000ed0410009c000000000103801900000060011002100000004002200210000000000121019f000003af00010430000000400200043d000700000002001d000000f8010000410000000000120435000000040120003903ad03620000040f00000007040000290000000001410049000000ed02000041000000ed0310009c0000000001028019000000ed0340009c000000000204401900000040022002100000006001100210000000000121019f000003af000104300000002002100039000000400300003900000000003204350000010c0200004100000000002104350000004003100039000000600200043d00000000002304350000006001100039000000000320004c000003240000613d000000000300001900000000043100190000008005300039000000000505043300000000005404350000002003300039000000000423004b0000031d0000413d000000000321001900000000000304350000001f02200039000000200300008a000000000232016f0000000001210019000000000001042d000000600100003900000001020000320000035b0000613d000000ee0120009c0000035c0000813d0000003f01200039000000200300008a000000000331016f000000400100043d0000000003310019000000000413004b00000000040000190000000104004039000000f70530009c0000035c0000213d00000001044001900000035c0000c13d000000400030043f0000000002210436000000030300036700000001050000310000001f0450018f00000005055002720000034c0000613d000000000600001900000005076002100000000008720019000000000773034f000000000707043b00000000007804350000000106600039000000000756004b000003440000413d000000000640004c0000035b0000613d0000000505500210000000000353034f00000000025200190000000304400210000000000502043300000000054501cf000000000545022f000000000303043b0000010004400089000000000343022f00000000034301cf000000000353019f0000000000320435000000000001042d000001040100004100000000001004350000004101000039000000040010043f0000010501000041000003af0001043000000060021000390000010d03000041000000000032043500000040021000390000010e03000041000000000032043500000020021000390000002a030000390000000000320435000000200200003900000000002104350000008001100039000000000001042d000000000110004c000003720000613d000000000001042d000000400100043d00000084021000390000010f030000410000000000320435000000640210003900000110030000410000000000320435000000440210003900000111030000410000000000320435000000240210003900000053030000390000000000320435000000f8020000410000000000210435000000040210003900000020030000390000000000320435000000ed02000041000000ed0310009c0000000001028019000000400110021000000112011001c7000003af000104300000000001000411000080010110008c0000038e0000c13d000000000001042d000000400100043d0000006402100039000000fa0300004100000000003204350000004402100039000000f9030000410000000000320435000000240210003900000024030000390000000000320435000000f8020000410000000000210435000000040210003900000020030000390000000000320435000000ed02000041000000ed0310009c0000000001028019000000400110021000000113011001c7000003af00010430000003a6002104210000000102000039000000000001042d0000000002000019000000000001042d000003ab002104230000000102000039000000000001042d0000000002000019000000000001042d000003ad00000432000003ae0001042e000003af00010430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffff00000000000000000000000000000000000000000000000100000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000020000000000000000000000000000004000000100000000000000000000000000000000000000000000000000000000000000000000000000038a24bc00000000000000000000000000000000000000000000000000000000817b17f00000000000000000000000000000000000000000000000000000000085fa292f0000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffff08c379a0000000000000000000000000000000000000000000000000000000004f6e6c7920626f6f746c6f616465722063616e2063616c6c2074686973206d6574686f64000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084000000800000000000000000ffffffff00000000000000000000000000000000000000000000000000000000949431dc00000000000000000000000000000000000000000000000000000000556e737570706f72746564207061796d617374657220666c6f770000000000000000000000000000000000000000000000000064000000800000000000000000496e76616c696420746f6b656e000000000000000000000000000000000000000000000000000000000000000000000000000064000000000000000000000000dd62ed3e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440000000000000000000000004e487b7100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002400000000000000000000000023b872dd0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001ffffffe002000000000000000000000000000000000000000000000000000000000000004d696e20616c6c6f77616e636520746f6f206c6f770000000000000000000000546865207374616e64617264207061796d617374657220696e707574206d757374206265206174206c656173742034206279746573206c6f6e67000000000000038a24bc000000000000000000000000000000000000000000000000000000007327206163636f756e74000000000000000000000000000000000000000000004661696c656420746f207472616e7366657246726f6d2066726f6d207573657269676874206e6f7420626520656e6f7567682e0000000000000000000000000020626f6f746c6f616465722e205061796d61737465722062616c616e6365206d4661696c656420746f207472616e736665722074782066656520746f2074686500000000000000000000000000000000000000a40000000000000000000000000000000000000000000000000000000000000084000000000000000000000000434a265b4e19f3e86ad50cc06218d532431413c7e6ec41818ab568730a6a8c79'
