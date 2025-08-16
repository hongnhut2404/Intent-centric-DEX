#!/bin/bash
# deploy-htlc.sh - Complete HTLC deployment script

set -e  # Exit on any error

echo "🚀 Starting HTLC Deployment Process..."
echo "======================================="

# Change to the project directory
cd "$(dirname "$0")" || exit 1

# Check if we're in the right directory
if [ ! -f "hardhat.config.js" ]; then
    echo "❌ Error: hardhat.config.js not found. Please run this script from the my-solidity-project directory."
    exit 1
fi

# Step 1: Deploy HTLC contract
echo ""
echo "📋 Step 1: Deploying HTLC contract..."
echo "======================================="
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy HTLC contract"
    exit 1
fi
echo "✅ HTLC contract deployed successfully"

# Step 2: Fund HTLC multisig wallet
echo ""
echo "💰 Step 2: Funding multisig wallet..."
echo "======================================="
npx hardhat run localhost-script/htlc/fund.js --network localhost
if [ $? -ne 0 ]; then
    echo "❌ Failed to fund multisig wallet"
    exit 1
fi
echo "✅ Multisig wallet funded successfully"

# Step 3: Copy contract addresses to frontend
echo ""
echo "📁 Step 3: Setting up frontend data..."
echo "======================================="

# Create frontend data directory if it doesn't exist
mkdir -p front-end/public/data

# Copy contract addresses
if [ -f "data/intent-matching-address.json" ]; then
    cp data/intent-matching-address.json front-end/public/data/
    echo "✅ Contract addresses copied to frontend"
else
    echo "⚠️  Warning: intent-matching-address.json not found"
fi

# Step 4: View initial HTLC state
echo ""
echo "👀 Step 4: Viewing initial HTLC state..."
echo "======================================="
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost
if [ $? -ne 0 ]; then
    echo "⚠️  Could not view HTLCs (this is normal if none exist yet)"
fi

echo ""
echo "🎉 HTLC Deployment Complete!"
echo "======================================="
echo "✅ HTLC contract deployed and funded"
echo "✅ Frontend configured with contract addresses"
echo "✅ Ready for atomic swap operations"
echo ""
echo "Next steps:"
echo "1. Start the frontend: cd front-end && npm run dev"
echo "2. Create buy/sell intents to trigger HTLC creation"
echo "3. Monitor HTLCs in the HTLC Status tab"
echo ""
echo "To create HTLCs manually:"
echo "BUY_ID=0 npx hardhat run localhost-script/htlc/createHTLC.js --network localhost"
echo ""
