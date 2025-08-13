#!/bin/bash
sleep 1
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
# ./bin/bitcoin-cli sendtoaddress bcrt1qh3py35f24dfgx0y6uaznfx66vhm88nh93qvpd0 100
bob_address=$(jq -r '.bob.address' ./data-script/state.json)

# Confirm it's stored correctly
echo "Sending to Bob: $bob_address"

# Send 10 BTC to Bob
./bin/bitcoin-cli sendtoaddress "$bob_address" 100
./bin/bitcoin-cli generatetoaddress 1 "$address"

# 5. Scan for UTXOs and write to JSON file
./bin/bitcoin-cli scantxoutset start "[\"addr($bob_address)\"]" > ./data-script/utxo.json

echo "Send successfully"
