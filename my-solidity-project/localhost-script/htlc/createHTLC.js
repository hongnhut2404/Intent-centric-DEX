const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load IntentMatching contract
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);

  // Get last matched trade (ID = matchedTradeCount - 1)
  const matchedTradeCount = await intentMatching.matchedTradeCount();
  if (matchedTradeCount === 0n) throw new Error("No matched trades found");
  const tradeId = matchedTradeCount - 1n;

  const trade = await intentMatching.matchedTrades(tradeId);
  const htlcAddress = await intentMatching.htlcAddress(); // read on-chain

  const timelock = trade.locktime;
  const recipient = trade.recipient;
  const amount = trade.ethAmount;
  const sender = trade.executor;

  const alice = await hre.ethers.getSigner(sender);
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress).connect(alice);

  // Generate secret and hashes
  const secret = "mysecret" + Date.now();
  const hashKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret)); // Ethereum
  const hashSha256 = crypto.createHash("sha256").update(secret).digest("hex"); // Bitcoin

  console.log("Creating lock with secret:", secret);
  let tx;
  try {
    tx = await htlc.newLock(recipient, hashKeccak, timelock, {
      value: amount,
    });
  } catch (error) {
    console.error("newLock failed:", error.reason || error.message);
    throw error;
  }

  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("Transaction failed");

  const event = receipt.logs
    .map(log => {
      try {
        return htlc.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(event => event && event.name === "Locked");

  if (!event) throw new Error("Locked event not found");

  const lockId = event.args.id;
  const lock = await htlc.getLock(lockId);

  // ✅ Final output
  console.log("HTLC Lock Created");
  console.log("Lock ID:", lockId);
  console.log("Secret:", secret);
  console.log("Keccak (ETH):", hashKeccak);
  console.log("SHA256 (BTC):", hashSha256);
  console.log("Timelock:", timelock.toString());
  console.log("Amount:", hre.ethers.formatEther(amount), "ETH");
  console.log("Sending amount:", amount, "wei =", hre.ethers.formatEther(amount), "ETH");
  console.log("Sender:", lock.sender);
  console.log("Recipient:", recipient);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
