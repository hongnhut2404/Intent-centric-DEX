#!/bin/bash

# Record start time
start_time=$(date +%s%3N)
echo "Start time: $start_time"

echo "Creating empty address-test.json..."
echo "{}" > ./data-script/address-test.json

echo "Initializing Alice and Bob key pairs..."
cd src/payment-channel
go run main.go init alice
go run main.go init bob

echo "Funding Bob's wallet from mining node..."
cd ../..
tmux send-keys -t bitcoin-chain-execute:bash.2 "./commands/fund-wallet.sh" C-m

# Record end time
end_time=$(date +%s%3N)

# Calculate elapsed time in milliseconds
elapsed_ms=$((end_time - start_time))

# Convert to seconds and milliseconds
seconds=$((elapsed_ms / 1000))
milliseconds=$((elapsed_ms % 1000))

echo ""
echo "Script completed in ${seconds}.${milliseconds} seconds."