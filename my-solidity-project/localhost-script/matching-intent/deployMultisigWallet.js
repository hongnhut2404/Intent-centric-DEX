const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // Parse number of owners from command line argument
    const numOwners = parseInt(process.argv[2] || "2");
    if (isNaN(numOwners) || numOwners < 1) {
        throw new Error("Usage: node deployMultisigWallet.js <number_of_owners>");
    }

    const signers = await ethers.getSigners();
    if (signers.length < numOwners + 1) {
        throw new Error(`You need at least ${numOwners + 1} accounts in your Hardhat network`);
    }

    const deployer = signers[0];
    const owners = signers.slice(1, numOwners + 1).map(s => s.address);
    console.log(`Deploying multisig with owners:`, owners);

    // Step 1: Deploy MultisigWallet
    const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
    const multisig = await MultisigWallet.deploy(owners);
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

    // Step 4: Parse event
    const iface = (await ethers.getContractFactory("IntentMatching")).interface;
    const event = receipt.logs
        .map(log => {
            try {
                return iface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find(parsed => parsed?.name === "MultisigWalletUpdated");

    if (event) {
        console.log("Event MultisigWalletUpdated emitted:");
        console.log("  Old wallet:", event.args.oldWallet);
        console.log("  New wallet:", event.args.newWallet);
    } else {
        console.warn("No MultisigWalletUpdated event found in logs.");
    }

    // Step 5: Double-check value is stored
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
