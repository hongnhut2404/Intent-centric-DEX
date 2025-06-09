if [[ ! -f /home/nhutthi/Documents/bitcoin-28.1/mineraddress.txt ]]; then
    echo "Error: mineraddress.txt not found in /home/nhutthi/Documents/bitcoin-28.1/"
    exit 1
fi

address=$(cat /home/nhutthi/Documents/bitcoin-28.1/mineraddress.txt)
# cmd=$(grep "miner_address" /home/nhutthi/Documents/bitcoin-28.1/address.txt | cut -d'=' -f2)
# 1. Generate 101 blocks to miner
bitcoin-cli generatetoaddress 103 $address
bitcoin-cli getwalletinfo

# 2. Get new block height
initial_height=$(bitcoin-cli getblockcount)

# 3. Fund sender wallet
bitcoin-cli sendtoaddress bcrt1qh3py35f24dfgx0y6uaznfx66vhm88nh93qvpd0 100

# 4. Wait for sender funding to be mined
echo "Waiting for the next block..."
while true; do
  current_height=$(bitcoin-cli getblockcount)
  if [[ "$current_height" -gt "$initial_height" ]]; then
    echo "New block mined at height: $current_height"
    break
  fi
  sleep 1
done

# 5. Now you can safely scan for UTXO
bitcoin-cli scantxoutset start "[\"addr(bcrt1qh3py35f24dfgx0y6uaznfx66vhm88nh93qvpd0)\"]" > /home/nhutthi/Documents/bitcoin-28.1/data-script/utxo.json
echo "send successfully"