#!/bin/bash
echo "Creating empty address-test.json..."
echo "{}" > ./data-script/address-test.json

echo "Initializing Alice and Bob key pairs..."
cd src/payment-channel
go run main.go init alice
go run main.go init bob

echo "Funding Bob's wallet from mining node..."
cd ../..
tmux send-keys -t bitcoin-chain-execute:bash.2 "./commands/fund-wallet.sh" C-m



