import type { SendTransactionRequest } from '~viem/actions/wallet/sendTransaction.js'
import type { ChainEIP712 } from '~viem/zksync/types/chain.js'
import type { Client } from '../../clients/createClient.js'
import type { Transport } from '../../clients/transports/createTransport.js'
import type { Account } from '../../types/account.js'
import type { Chain } from '../../types/chain.js'
import {
  type RequestExecuteParameters,
  type RequestExecuteReturnType,
  requestExecute,
} from '../actions/requestExecute.js'

export type WalletActionsL1<
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
> = {
  requestExecute: <
    const request extends SendTransactionRequest<chain, chainOverride>,
    chainOverride extends Chain | undefined = undefined,
    chainL2 extends ChainEIP712 = ChainEIP712,
  >(
    parameters: RequestExecuteParameters<
      chain,
      account,
      chainOverride,
      chainL2,
      request
    >,
  ) => Promise<RequestExecuteReturnType>
}

export function walletActionsL1() {
  return <
    transport extends Transport,
    chain extends Chain | undefined = Chain | undefined,
    account extends Account | undefined = Account | undefined,
  >(
    client: Client<transport, chain, account>,
  ): WalletActionsL1<chain, account> => ({
    requestExecute: (args) => requestExecute(client, args),
  })
}
