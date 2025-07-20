const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load IntentMatching address and retrieve HTLC address from it
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();
  const htlc = await HTLC.attach(htlcAddress);

  console.log(`HTLC contract at: ${htlcAddress}`);
  const htlcs = await htlc.getAllHTLCs();

  if (htlcs.length === 0) {
    console.log("No HTLCs found.");
    return;
  }

  for (let i = 0; i < htlcs.length; i++) {
    const lock = htlcs[i];
    console.log(`\nHTLC #${i}`);
    console.log(`Recipient   : ${lock.recipient}`);
    console.log(`Secret Hash : ${lock.secretHash}`);
    console.log(`Amount (ETH): ${hre.ethers.formatEther(lock.amount)} ETH`);
    console.log(`Timelock    : ${new Date(Number(lock.timelock) * 1000).toLocaleString()}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
