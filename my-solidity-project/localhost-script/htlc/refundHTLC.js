const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load HTLC address via IntentMatching
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  // 1️⃣ Fetch the most recent Locked event
  const filter = htlc.filters.Locked();
  const events = await htlc.queryFilter(filter, "latest");

  if (events.length === 0) {
    throw new Error("No Locked events found");
  }

  const lastEvent = events[events.length - 1];
  const { id: lockId, sender } = lastEvent.args;

  // 2️⃣ Get lock info from on-chain
  const lock = await htlc.getLock(lockId);

  console.log("HTLC Lock Info:");
  console.log("- Sender:    ", lock.sender);
  console.log("- Recipient: ", lock.recipient);
  console.log("- Amount:    ", hre.ethers.formatEther(lock.amount), "ETH");
  console.log("- Timelock:  ", lock.timelock.toString());
  console.log("- Withdrawn: ", lock.withdrawn);
  console.log("- Refunded:  ", lock.refunded);

  // 3️⃣ Check time
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime < lock.timelock) {
    console.log("Timelock has not expired yet. Cannot refund.");
    return;
  }

  // 4️⃣ Refund
  console.log("Refunding lockId:", lockId);
  const signer = await hre.ethers.getSigner(sender);
  const tx = await htlc.connect(signer).refund(lockId);
  await tx.wait();

  console.log("Refund successful.");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
