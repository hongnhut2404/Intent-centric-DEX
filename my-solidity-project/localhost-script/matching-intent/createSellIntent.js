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

  // Define multiple sell intents (in ETH / BTC units)
  const sellIntents = [
    { amountBTC: 1.0, minBuyETH: "0.75" },
    { amountBTC: 8.0,  minBuyETH: "6.0" },
    { amountBTC: 20.0, minBuyETH: "12.0" }
  ];

  for (const { amountBTC, minBuyETH } of sellIntents) {
    const sellAmount = BigInt(amountBTC * 1e8); // BTC to satoshi
    const minBuyAmount = hre.ethers.parseUnits(minBuyETH, 18); // ETH to wei

    const tx = await contract
      .connect(user2)
      .createSellIntent(sellAmount, minBuyAmount, deadline, offchainId);

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
  - sellAmount: ${Number(sellAmount) / 1e8} BTC
  - minBuyAmount: ${hre.ethers.formatEther(minBuyAmount)} ETH
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
