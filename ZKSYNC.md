## Running tests

Prepare the test environment:
```sh
# run the hyperchain environment using local-setup by executing (start-zk-chains.sh)

export CUSTOM_TOKEN_ADDRESS=$(docker exec local-setup-zksync-1 awk -F": " '/tokens:/ {found_tokens=1} found_tokens && /DAI:/ {found_dai=1} found_dai && /address:/ {print $2; exit}' /configs/erc20.yaml)
pnpm run zksync:test:prepare
```

Run the tests:
```sh
export SKIP_GLOBAL_SETUP=true

# optional to remove wearings on console
export VITE_ANVIL_FORK_URL=https://cloudflare-eth.com
export VITE_ANVIL_FORK_URL_SEPOLIA=https://rpc.sepolia.org
export VITE_ANVIL_FORK_URL_OPTIMISM=https://mainnet.optimism.io
export VITE_ANVIL_FORK_URL_ZKSYNC=https://mainnet.era.zksync.io
```

Run the tests from some file:
```sh
vitest  --run -c test/vitest.config.ts src/zksync/actions/requestExecute.test.ts
vitest  --run -c test/vitest.config.ts src/zksync/actions/deposit.test.ts
vitest  --run -c test/vitest.config.ts src/zksync/decorators/walletL2.test.ts
vitest  --run -c test/vitest.config.ts src/zksync/utils/bridge/getWithdrawalL2ToL1Log.test.ts
# ...
```

Run all tests:
```sh
# since transactions are run in parallel some tests will fail because of nonce ordering
# you can run tests in sequential mode to prevent this but it will take to much time execute tests
vitest  --run -c test/vitest.config.ts src/zksync/**
```
