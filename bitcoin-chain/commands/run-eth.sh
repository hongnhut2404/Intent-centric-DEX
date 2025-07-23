npx hardhat run localhost-script/matching-intent/deployIntentMatching.js --network localhost
npx hardhat run localhost-script/matching-intent/deployMultisigWallet.js --network localhost


npx hardhat run localhost-script/matching-intent/createBuyIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/createSellIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/confirmSellIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/viewAllIntents.js --network localhost

BUY_ID=0 npx hardhat run localhost-script/matching-intent/matchingIntentComponent.js --network localhost
TX_ID=3 npx hardhat run localhost-script/matching-intent/confirmMultisigTx.js --network localhost

npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
npx hardhat run localhost-script/htlc/fund.js --network localhost

npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost