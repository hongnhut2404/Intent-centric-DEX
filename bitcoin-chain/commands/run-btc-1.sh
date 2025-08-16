#!/bin/bash

# Record start time
start_time=$(date +%s%3N)
echo "Start time: $start_time"

echo "Creating empty address-test.json..."
echo "{}" > ./data-script/address-test.json

cd bitcoin-chain
mux start -p ../.tmuxinator/bitcoin-chain-execute.yml

echo "Initializing Alice and Bob key pairs..."
cd src/payment-channel
go run main.go init alice
go run main.go init bob

# This is the fund wallet command. Use to fund the wallet of User (Bob) to start the transaction 
echo "Funding Bob's wallet from mining node..."
cd ../..
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
bob_address=$(jq -r '.bob.address' ./data-script/state.json)

# Confirm it's stored correctly
echo "Sending to Bob: $bob_address"

# Send 10 BTC to Bob
./bin/bitcoin-cli sendtoaddress "$bob_address" 100
./bin/bitcoin-cli generatetoaddress 1 "$address"

# 5. Scan for UTXOs and write to JSON file
./bin/bitcoin-cli scantxoutset start "[\"addr($bob_address)\"]" > ./data-script/utxo.json

# End of fund wallet command

echo "Send successfully"

echo "Generating payment message with secret and OP_RETURN..."
cd src/payment-channel
go run main.go generate-message

echo "Verifying OP_RETURN content and checking signature..."
go run main.go verify-opreturn ../../data-script/payment_message.json ../../data-script/payment_opreturn.txt

echo "Creating Bitcoin HTLC contract from extracted info..."
cd ../htlc/create-htlc
go run *.go

echo "Funding the Bitcoin HTLC..."
cd ../fund
go run *.go

echo "Waiting for funds to be mined into the HTLC (60 seconds)..."
sleep 60 
#(Actually 600s in case block time = 600s)

echo "Scanning HTLC address to collect UTXO data..."
cd ../scan-htlc
go run *.go

echo "Creating redeem transaction to claim HTLC output..."
cd ../create-redeem
go run *.go

echo "Signing the redeem transaction with secret and private key..."
cd ../sign-redeem
go run *.go

echo "Workflow completed. You can now broadcast the signed transaction manually."


# Record end time
end_time=$(date +%s%3N)

# Calculate elapsed time in milliseconds
elapsed_ms=$((end_time - start_time))

# Convert to seconds and milliseconds
seconds=$((elapsed_ms / 1000))
milliseconds=$((elapsed_ms % 1000))

echo ""
echo "Script completed in ${seconds}.${milliseconds} seconds."