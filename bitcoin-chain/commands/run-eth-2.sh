#!/bin/bash

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
