const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = 0; // Change this as needed

  // Load IntentMatching contract
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");

  const [deployer] = await hre.ethers.getSigners(); // Must be the owner of IntentMatching
  const intentMatching = await IntentMatching.connect(deployer).attach(intentMatchingAddress);

  const htlcAddress = await intentMatching.htlcAddress();
  const htlc = await HTLC.attach(htlcAddress);

  const matchedTradeCount = await intentMatching.matchedTradeCount();
  if (matchedTradeCount === 0n) throw new Error("No matched trades found");

  // Shared secret
  const secret = "mysecret" + Date.now();
  const hashKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret));
  const hashSha256 = crypto.createHash("sha256").update(secret).digest("hex");

  let created = 0;

  for (let i = 0n; i < matchedTradeCount; i++) {
    const trade = await intentMatching.matchedTrades(i);
    if (trade.buyIntentId !== BigInt(buyIntentId)) continue;

    const executor = await hre.ethers.getSigner(trade.executor);
    const htlcWithSigner = htlc.connect(executor);

    console.log(`Creating lock for Trade ${i} to ${trade.recipient}`);
    let tx;
    try {
      tx = await htlcWithSigner.newLock(trade.recipient, hashKeccak, trade.locktime, {
        value: trade.ethAmount
      });
    } catch (error) {
      console.error("newLock failed:", error.reason || error.message);
      continue;
    }

    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      console.error("Transaction failed for trade", i);
      continue;
    }

    // Parse Locked event
    const event = receipt.logs
      .map(log => {
        try {
          return htlc.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "Locked");

    if (!event) {
      console.error("Locked event not found for trade", i);
      continue;
    }

    const lockId = event.args.id;

    // Emit HTLCAssociated from IntentMatching
    try {
      const tx2 = await intentMatching.associateHTLC(buyIntentId, lockId, trade.recipient, hashKeccak);
      await tx2.wait();
    } catch (error) {
      console.error("associateHTLC failed:", error.reason || error.message);
      continue;
    }

    console.log(`HTLC created: lockId=${lockId}, amount=${hre.ethers.formatEther(trade.ethAmount)} ETH`);
    created++;
  }

  if (created === 0) {
    console.log("No HTLCs created for BuyIntent", buyIntentId);
  } else {
    console.log("All HTLCs created for BuyIntent", buyIntentId);
    console.log("Shared Secret:", secret);
    console.log("Keccak256 (ETH):", hashKeccak);
    console.log("SHA256 (BTC):", hashSha256);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
