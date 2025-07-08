const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load HTLC address from IntentMatching
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();

  // Connect to HTLC
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  // Get all Locked events
  const filter = htlc.filters.Locked();
  const events = await htlc.queryFilter(filter, 0, "latest");

  if (events.length === 0) {
    console.log("No HTLCs found.");
    return;
  }

  console.log(`🔐 Found ${events.length} HTLC locks:\n`);

  for (const event of events) {
    const { id: lockId } = event.args;
    const lock = await htlc.getLock(lockId);

    const expired = Math.floor(Date.now() / 1000) > lock.timelock;
    const isActive = !lock.withdrawn && !lock.refunded;

    console.log(`Lock ID:     ${lockId}`);
    console.log(`  Sender:     ${lock.sender}`);
    console.log(`  Recipient:  ${lock.recipient}`);
    console.log(`  Amount:     ${hre.ethers.formatEther(lock.amount)} ETH`);
    console.log(`  Timelock:   ${lock.timelock.toString()} ${expired ? "(⏰ expired)" : ""}`);
    console.log(`  Withdrawn:  ${lock.withdrawn}`);
    console.log(`  Refunded:   ${lock.refunded}`);
    console.log(`  Status:     ${isActive ? "🟢 Active" : "🔴 Inactive"}\n`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
