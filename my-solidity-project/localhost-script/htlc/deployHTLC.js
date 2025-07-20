const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load intent-matching address
  const filePath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("intent-matching-address.json not found");
  }

  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(filePath));
  if (!intentMatchingAddress) {
    throw new Error("IntentMatching address not found in JSON file");
  }

  const [deployer] = await hre.ethers.getSigners();

  // Load IntentMatching contract
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);

  // Get multisig wallet address from on-chain storage
  const multisigAddress = await intentMatching.multisigWallet();
  if (!multisigAddress || multisigAddress === hre.ethers.ZeroAddress) {
    throw new Error("Multisig wallet is not set in IntentMatching contract");
  }

  // Deploy HTLC with multisig address
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.deploy(multisigAddress); 
  console.log("HTLC deployed to:", htlc.target);

  // Register HTLC address in IntentMatching
  const tx = await intentMatching.connect(deployer).setHTLCAddress(htlc.target);
  await tx.wait();

  console.log("HTLC address stored on-chain in IntentMatching contract.");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
