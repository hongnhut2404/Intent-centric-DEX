const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // Read optional command-line arguments
    const numOwners = parseInt(process.argv[2] || "2");
    const numRequired = parseInt(process.argv[3] || "2");

    if (isNaN(numOwners) || numOwners < 1) {
        throw new Error("Invalid number of owners. Usage: node deployMultisigWallet.js [numOwners] [numRequiredConfirmations]");
    }

    if (isNaN(numRequired) || numRequired < 1 || numRequired > numOwners) {
        throw new Error("Invalid number of required confirmations. It must be between 1 and numOwners.");
    }

    const signers = await ethers.getSigners();
    if (signers.length < numOwners + 1) {
        throw new Error(`You need at least ${numOwners + 1} accounts in your Hardhat network`);
    }

    const deployer = signers[0];
    const owners = signers.slice(1, numOwners + 1).map(s => s.address);
    console.log(`Deploying ${numRequired}-of-${numOwners} multisig with owners:`, owners);

    // Step 1: Deploy MultisigWallet
    const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
    const multisig = await MultisigWallet.deploy(owners, numRequired);
    await multisig.waitForDeployment();
    const multisigAddress = await multisig.getAddress();
    console.log("MultisigWallet deployed at:", multisigAddress);

    // Step 2: Load IntentMatching address
    const { address: intentMatchingAddress } = JSON.parse(
        fs.readFileSync("data/intent-matching-address.json", "utf8")
    );
    console.log("IntentMatching loaded from JSON:", intentMatchingAddress);

    // Step 3: Store multisig address on-chain
    const intentMatching = await ethers.getContractAt("IntentMatching", intentMatchingAddress);
    const tx = await intentMatching.setMultisigWallet(multisigAddress);
    const receipt = await tx.wait();
    console.log("setMultisigWallet() transaction confirmed.");

    // Step 4: Confirm stored value
    const onChainAddress = await intentMatching.multisigWallet();
    if (onChainAddress === multisigAddress) {
        console.log("Verified: multisigWallet address set correctly on-chain.");
    } else {
        console.error("Mismatch! Expected:", multisigAddress, "but found:", onChainAddress);
    }
}

main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
});
