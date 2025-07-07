// scripts/matchingIntentComponent.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const { address } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json")
  );
  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const contract = await IntentMatching.attach(address);

  console.log("Matching intents...");

  const matchTx = await contract.matchIntent(0);
  const receipt = await matchTx.wait();

  let matchedTradeId;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);

      if (parsed.name === "TradeMatched") {
        const [buyIntentId, sellIntentId, recipient, token, sender, amountETH, amountBTC, locktime] =
          parsed.args;

        console.log(`✅ TradeMatched event:
  - buyIntentId: ${buyIntentId}
  - sellIntentId: ${sellIntentId}
  - recipient: ${recipient}
  - executor(sender): ${sender}
  - ETH amount: ${amountETH}
  - BTC amount: ${amountBTC}
  - locktime: ${locktime}`);

        // use matchedTradeCount-1 because it increments after storing
        matchedTradeId = await contract.matchedTradeCount() - 1n;

        // retrieve from contract storage
        const storedTrade = await contract.matchedTrades(matchedTradeId);

        console.log(`🟢 Stored on-chain matched trade:
  - buyIntentId: ${storedTrade.buyIntentId}
  - sellIntentId: ${storedTrade.sellIntentId}
  - recipient: ${storedTrade.recipient}
  - ethAmount: ${storedTrade.ethAmount}
  - btcAmount: ${storedTrade.btcAmount}
  - locktime: ${storedTrade.locktime}
  - timestamp: ${storedTrade.timestamp}
        `);

        // if you want to pass to HTLC script directly:
        console.log(`⚡ Pass to HTLC:
  - recipient: ${storedTrade.recipient}
  - ethAmount: ${storedTrade.ethAmount}
  - locktime: ${storedTrade.locktime}
        `);

      }
    } catch (err) {
      console.error("Log parsing error:", err.message);
    }
  }
}

main().catch(console.error);
