echo "Setting up the mining wallet..."
sleep 3
bitcoin-cli createwallet "wallet-miner"


echo "Prepare to generate blocks..."
sleep 3
./commands/generate-block.sh