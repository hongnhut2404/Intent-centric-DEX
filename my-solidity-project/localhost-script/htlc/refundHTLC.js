const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  const lockedEvents = await htlc.queryFilter(htlc.filters.Locked());

  if (lockedEvents.length === 0) {
    console.log("No Locked events found.");
    return;
  }

  let refundedCount = 0;

  for (const event of lockedEvents) {
    const { id: lockId, sender } = event.args;
    const lock = await htlc.getLock(lockId);

    if (lock.withdrawn || lock.refunded) {
      console.log(`Skipping lockId ${lockId}: already withdrawn or refunded.`);
      continue;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < lock.timelock) {
      console.log(`Skipping lockId ${lockId}: not yet expired (timelock = ${lock.timelock})`);
      continue;
    }

    const signer = await hre.ethers.getSigner(sender);
    const balanceBefore = await hre.ethers.provider.getBalance(sender);

    console.log(`Refunding lockId: ${lockId}`);
    console.log("Sender:  ", sender);
    console.log("Amount:  ", hre.ethers.formatEther(lock.amount), "ETH");

    try {
      const tx = await htlc.connect(signer).refund(lockId);
      await tx.wait();

      const balanceAfter = await hre.ethers.provider.getBalance(sender);
      console.log("Refund successful.");
      console.log("Balance before:", hre.ethers.formatEther(balanceBefore));
      console.log("Balance after: ", hre.ethers.formatEther(balanceAfter));
      refundedCount++;
    } catch (err) {
      console.error(`Refund failed for lockId ${lockId}:`, err.reason || err.message);
    }
  }

  if (refundedCount === 0) {
    console.log("\nNo refundable HTLCs found.");
  } else {
    console.log(`\nRefunded ${refundedCount} HTLC(s).`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
