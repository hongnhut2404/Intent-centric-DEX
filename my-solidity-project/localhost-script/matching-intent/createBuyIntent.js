const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
  const [_, user1] = await hre.ethers.getSigners();

  const { address } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(address);

  const locktime = Math.floor(Date.now() / 1000) + 3600;
  const offchainId = ethers.encodeBytes32String("buy-eth");

  // Define multiple buy intents (amounts in BTC/ETH, not sat/wei)
  const buyIntents = [
    { amountBTC: 2.0, minBuyETH: "1.5" },
    { amountBTC: 8.0, minBuyETH: "4.2" },
    { amountBTC: 5.0, minBuyETH: "2.75" }
  ];

  for (const { amountBTC, minBuyETH } of buyIntents) {
    const sellAmount = BigInt(amountBTC * 1e8); // BTC → satoshi
    const minBuyAmount = hre.ethers.parseUnits(minBuyETH, 18); // ETH → wei

    const tx = await contract
      .connect(user1)
      .createBuyIntent(sellAmount, minBuyAmount, locktime, offchainId);

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
        if (parsed.name === "BuyIntentCreated") {
          const {
            intentId,
            buyer,
            sellAmount,
            minBuyAmount,
            locktime: emittedLocktime
          } = parsed.args;

          console.log(`BuyIntent created:
  - id: ${intentId}
  - buyer: ${buyer}
  - sellAmount: ${Number(sellAmount) / 1e8} BTC
  - minBuyAmount: ${hre.ethers.formatEther(minBuyAmount)} ETH
  - locktime: ${emittedLocktime}
          `);
        }
      } catch (e) {
        console.log("Unparsed log, skipping, reason:", e.message);
      }
    }
  }

  console.log("All BuyIntents created by User1");
}

main().catch(console.error);
