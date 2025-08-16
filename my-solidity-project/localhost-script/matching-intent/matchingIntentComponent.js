const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const buyIntentId = parseInt(process.env.BUY_ID, 10);
  if (Number.isNaN(buyIntentId)) throw new Error("Usage: BUY_ID=<id> ...");

  const execIndex = process.env.EXEC_INDEX ? parseInt(process.env.EXEC_INDEX, 10) : 2; // solver EOA
  const signers = await ethers.getSigners();
  const executor = signers[execIndex];

  const { address } = JSON.parse(fs.readFileSync("data/intent-matching-address.json", "utf8"));
  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(address).connect(executor);

  console.log(`Executor: ${executor.address}`);
  console.log(`Calling matchIntent(${buyIntentId}) on ${address}...`);
  const tx = await contract.matchIntent(buyIntentId);
  const rc = await tx.wait();
  console.log("Tx:", rc.hash);

  // Show TradeMatched events from this tx
  for (const log of rc.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed.name === "TradeMatched") {
        const { buyIntentId, sellIntentId, executor, seller, buyer, ethAmount, btcAmount, locktime } = parsed.args;
        console.log(`Matched:
  - BuyIntent ID: ${buyIntentId}
  - SellIntent ID: ${sellIntentId}
  - Executor:     ${executor}
  - Buyer:        ${buyer}
  - Seller:       ${seller}
  - ETH:          ${ethers.formatEther(ethAmount)}
  - BTC:          ${Number(btcAmount) / 1e8}
  - Locktime:     ${locktime}`);
      }
    } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });