## Running tests

Prepare the test environment:
```sh
# run the hyperchain environment using local-setup by executing (start-zk-chains.sh)

export CUSTOM_TOKEN_ADDRESS=$(docker exec local-setup-zksync-1 awk -F": " '/tokens:/ {found_tokens=1} found_tokens && /DAI:/ {found_dai=1} found_dai && /address:/ {print $2; exit}' /configs/erc20.yaml)
pnpm run zksync:test:prepare
```

Run the tests:
```sh

```