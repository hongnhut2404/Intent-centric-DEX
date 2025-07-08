const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Deploy HTLC contract
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  console.log("HTLC deployed to:", htlc.target);

  // Read IntentMatching address from JSON
  const filePath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("intent-matching-address.json not found");
  }

  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(filePath));
  if (!intentMatchingAddress) {
    throw new Error("IntentMatching address not found in JSON file");
  }

  // Attach to IntentMatching and set HTLC address
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const [deployer] = await hre.ethers.getSigners();

  const tx = await intentMatching.connect(deployer).setHTLCAddress(htlc.target);
  await tx.wait();

  console.log("HTLC address stored on-chain in IntentMatching contract.");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
