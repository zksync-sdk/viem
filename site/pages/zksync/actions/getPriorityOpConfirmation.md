---
description: Returns the transaction confirmation data that is part of L2 to L1 message.
---

# getPriorityOpConfirmation

Returns the transaction confirmation data that is part of `L2->L1` message.

## Usage

:::code-group

```ts [example.ts]
import { client } from './config'

const hash = await client.getPriorityOpConfirmation({
  hash: '0x…',
})
```

```ts [config.ts]
import { createPublicClient, custom } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { zksync, mainnet } from 'viem/chains'
import { publicActionsL2 } from 'viem/zksync'

export const client = createPublicClient({
  chain: zksync,
  transport: custom(window.ethereum)
}).extend(publicActionsL2())
```

:::


## Returns

- **Type:** `GetPriorityOpConfirmationReturnType`

The transaction confirmation data that is part of `L2->L1` message.

## Parameters

### hash 

- **Type:** `Hex`

The hash of the L2 transaction where the message was initiated.

```ts
const hash = await client.getPriorityOpConfirmation({
  hash: '0x…',  // [!code focus]
})
```

### index (optional)

- **Type:** `number`
- **Default:** `0`

In case there were multiple transactions in one message, you may pass an index of the
transaction which confirmation data should be fetched.

```ts
const hash = await client.getPriorityOpConfirmation({
  hash: '0x…',
  index: 0n, // [!code focus]
})
```

### chain (optional)

- **Type:** [`Chain`](/docs/glossary/types#chain)
- **Default:** `client.chain`

The target chain. If there is a mismatch between the wallet's current chain & the target chain, an error will be thrown.

```ts
import { zksync } from 'viem/chains' // [!code focus]

const hash = await client.getPriorityOpConfirmation({
  chain: zksync, // [!code focus]
  hash: '0x…',
})
```