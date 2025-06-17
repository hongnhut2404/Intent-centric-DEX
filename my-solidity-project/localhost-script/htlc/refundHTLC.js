const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function readInput(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(data);
    const requiredFields = ["htlcAddress", "lockId", "sender"];

    for (const field of requiredFields) {
      if (
        !parsed.hasOwnProperty(field) ||
        parsed[field] === null ||
        parsed[field] === undefined
      ) {
        throw new Error(`Missing or null field in input JSON: ${field}`);
      }
    }
    return parsed;

  } catch (error) {
    console.error("Error reading or parsing input file:", error.message);
    process.exit(1);
  }
}

async function main() {
  const input = readInput("../../data/htlc-data.json");

  // Read the input data
  const htlcAddress = input.htlcAddress; 
  const lockId = input.lockId; 
  const sender = input.sender; 
  const signer = await hre.ethers.getSigner(sender);

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  // Check current lock status before refund
  const lock = await htlc.getLock(lockId);
  console.log("Lock info:", {
    sender: lock.sender,
    recipient: lock.recipient,
    amount: hre.ethers.formatEther(lock.amount),
    timelock: lock.timelock.toString(),
    withdrawn: lock.withdrawn,
    refunded: lock.refunded,
  });

  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime < lock.timelock) {
    console.log("Timelock has not expired yet.");
    return;
  }

  console.log("Refunding...");
  const tx = await htlc.connect(signer).refund(lockId);
  await tx.wait();
  console.log("Refund successful.");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
