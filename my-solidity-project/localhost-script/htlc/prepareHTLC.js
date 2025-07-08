// scripts/htlc/prepareHTLC.js
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function main() {
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);

  const [owner] = await hre.ethers.getSigners(); // assumes you're the owner

  const count = await intentMatching.matchedTradeCount();
  if (count === 0n) throw new Error("No matched trades found");

  const tradeId = count - 1n;
  const trade = await intentMatching.matchedTrades(tradeId);

  const buyIntentId = trade.buyIntentId;
  const sellIntentId = trade.sellIntentId;
  const timelock = trade.locktime;

  // Generate secret + hashes
  const secret = "mysecret" + Date.now();
  const secretHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret));

  const btcReceiver = "btc-address-placeholder"; // replace with actual BTC address

  const tx = await intentMatching
    .connect(owner)
    .prepareHTLC(buyIntentId, sellIntentId, secretHash, timelock, btcReceiver);

  await tx.wait();

  console.log("✅ HTLCPrepared event emitted.");
  console.log("Secret:", secret);
  console.log("SecretHash:", secretHash);
  console.log("Timelock:", timelock.toString());
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
