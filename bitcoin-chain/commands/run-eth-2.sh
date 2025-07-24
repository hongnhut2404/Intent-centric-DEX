#!/bin/bash

# Record start time
start_time=$(date +%s%3N)
echo "Start time: $start_time"

# Stop on error
set -e

echo "Reveal the secret on-chain"
echo "----------------------------------------"
# This will broadcast the secret via the revealSecret() function in the HTLC contract
npx hardhat run localhost-script/htlc/revealSecret.js --network localhost

echo ""
echo "Claim the fund using revealed secret"
echo "--------------------------------------------------"
# This will listen for SecretRevealed event and use it to withdraw via multisig
npx hardhat run localhost-script/htlc/withdrawHTLC.js --network localhost

echo ""
echo "Process complete."

# Record end time in milliseconds
end_time=$(date +%s%3N)

# Calculate elapsed time in milliseconds
elapsed_ms=$((end_time - start_time))

# Convert to seconds and milliseconds
seconds=$((elapsed_ms / 1000))
milliseconds=$((elapsed_ms % 1000))

echo ""
echo "Script completed in ${seconds}.${milliseconds} seconds."