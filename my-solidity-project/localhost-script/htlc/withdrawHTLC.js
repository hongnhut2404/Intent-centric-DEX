const hre = require("hardhat");
const readline = require("readline-sync");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load HTLC address from IntentMatching
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  // 🔍 Fetch the most recent Locked event
  const filter = htlc.filters.Locked();
  const events = await htlc.queryFilter(filter, "latest");

  if (events.length === 0) {
    throw new Error("No Locked events found.");
  }

  const lastEvent = events[events.length - 1];
  const { id: lockId, recipient } = lastEvent.args;

  // 📥 Ask for secret from user
  const secret = readline.question("Enter the secret preimage: ");
  const signer = await hre.ethers.getSigner(recipient);

  // 💰 Check balance before
  const balanceBefore = await hre.ethers.provider.getBalance(recipient);
  console.log("Balance before:", hre.ethers.formatEther(balanceBefore), "ETH");

  // 🚀 Withdraw
  console.log("Withdrawing HTLC for lockId:", lockId);
  const tx = await htlc.connect(signer).withdraw(lockId, secret);
  await tx.wait();
  console.log("Withdrawal successful!");

  //Check balance after
  const balanceAfter = await hre.ethers.provider.getBalance(recipient);
  console.log("Balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
