// scripts/createSellIntents.js
const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
  const [_, __, user2] = await hre.ethers.getSigners();

  const { address } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json")
  );

  console.log("Using IntentMatching contract at address:", address);

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(address);

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const offchainId = ethers.encodeBytes32String("sell-eth");

  // define multiple sell intents
  const sellIntents = [
    { amount: 15, minBuy: 9 },
    { amount: 5,  minBuy: 1 },
    { amount: 20, minBuy: 12 }
  ];

  for (const { amount, minBuy } of sellIntents) {
    const tx = await contract
      .connect(user2)
      .createSellIntent(amount, minBuy, deadline, offchainId);

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction mined in block ${receipt.blockNumber}`);

    if (!receipt.logs || receipt.logs.length === 0) {
      console.log("No logs found in transaction receipt. Maybe it reverted or no events emitted.");
      continue;
    }

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed.name === "SellIntentCreated") {
          const {
            intentId,
            seller,
            sellAmount,
            minBuyAmount,
            deadline: emittedDeadline
          } = parsed.args;

          console.log(`SellIntent created:
  - id: ${intentId}
  - seller: ${seller}
  - sellAmount: ${sellAmount}
  - minBuyAmount: ${minBuyAmount}
  - deadline: ${emittedDeadline}
          `);
        }
      } catch (e) {
        console.log("Unparsed log, skipping, reason:", e.message);
      }
    }
  }

  console.log("All SellIntents created by User2");
}

main().catch(console.error);
