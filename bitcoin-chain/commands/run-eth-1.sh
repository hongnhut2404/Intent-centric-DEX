#!/bin/bash
# Record start time
start_time=$(date +%s%3N)
echo "Start time: $start_time"

cd my-solidity-project/
echo "Deploying IntentMatching contract..."
npx hardhat run localhost-script/matching-intent/deployIntentMatching.js --network localhost

echo "Deploying MultisigWallet contract..."
npx hardhat run localhost-script/matching-intent/deployMultisigWallet.js --network localhost

echo "Creating BuyIntent..."
npx hardhat run localhost-script/matching-intent/createBuyIntent.js --network localhost

echo "Creating SellIntent..."
npx hardhat run localhost-script/matching-intent/createSellIntent.js --network localhost

echo "Confirming SellIntent..."
npx hardhat run localhost-script/matching-intent/confirmSellIntent.js --network localhost

echo "Viewing all Buy and Sell intents..."
npx hardhat run localhost-script/matching-intent/viewAllIntents.js --network localhost

echo "Matching BuyIntent with ID = 0..."
BUY_ID=0 npx hardhat run localhost-script/matching-intent/matchingIntentComponent.js --network localhost

echo "Confirming multisig transaction with TX_ID = 3..."
TX_ID=3 npx hardhat run localhost-script/matching-intent/confirmMultisigTx.js --network localhost

echo "Deploying HTLC contract..."
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost

echo "Funding HTLC contract..."
npx hardhat run localhost-script/htlc/fund.js --network localhost

echo "Creating HTLCs for matched trades..."
npx hardhat run localhost-script/htlc/createHTLC.js --network localhost

echo "Viewing all HTLCs..."
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost


# Record end time in milliseconds
end_time=$(date +%s%3N)

# Calculate elapsed time in milliseconds
elapsed_ms=$((end_time - start_time))

# Convert to seconds and milliseconds
seconds=$((elapsed_ms / 1000))
milliseconds=$((elapsed_ms % 1000))

echo ""
echo "Script completed in ${seconds}.${milliseconds} seconds."