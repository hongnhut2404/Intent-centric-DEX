#!/bin/bash

if [[ ! -f ./mineraddress.txt ]]; then
    echo "Error: mineraddress.txt not found in $(pwd)"
    exit 1
fi

address=$(cat ./mineraddress.txt)

# 1. Generate 103 blocks to miner address
./bin/bitcoin-cli generatetoaddress 103 "$address"
./bin/bitcoin-cli getwalletinfo

# 2. Get current block height
initial_height=$(./bin/bitcoin-cli getblockcount)

# 3. Fund sender wallet
./bin/bitcoin-cli sendtoaddress bcrt1qh3py35f24dfgx0y6uaznfx66vhm88nh93qvpd0 100

# 4. Wait for the next block to be mined
echo "Waiting for the next block..."
while true; do
  current_height=$(./bin/bitcoin-cli getblockcount)
  if [[ "$current_height" -gt "$initial_height" ]]; then
    echo "New block mined at height: $current_height"
    break
  fi
  sleep 1
done

# 5. Scan for UTXOs and write to JSON file
./bin/bitcoin-cli scantxoutset start "[\"addr(bcrt1qh3py35f24dfgx0y6uaznfx66vhm88nh93qvpd0)\"]" > ./data-script/utxo.json

echo "Send successfully"
