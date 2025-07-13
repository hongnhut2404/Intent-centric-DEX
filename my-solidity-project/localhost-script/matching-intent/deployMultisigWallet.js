const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer, owner1, owner2] = await ethers.getSigners();

    // Step 1: Deploy MultisigWallet with n-of-n setup
    const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
    const multisig = await MultisigWallet.deploy([owner1.address, owner2.address]);
    await multisig.waitForDeployment();

    const multisigAddress = await multisig.getAddress();
    console.log("MultisigWallet deployed at:", multisigAddress);

    // Step 2: Load IntentMatching address from JSON
    const json = fs.readFileSync("data/intent-matching-address.json", "utf8");
    const { address: intentMatchingAddress } = JSON.parse(json);
    console.log("IntentMatching loaded from JSON:", intentMatchingAddress);

    // Step 3: Store multisig address on-chain
    const intentMatching = await ethers.getContractAt("IntentMatching", intentMatchingAddress);
    const tx = await intentMatching.setMultisigWallet(multisigAddress);
    const receipt = await tx.wait();

    console.log("setMultisigWallet() transaction confirmed.");

    // Step 4: Parse the event using contract interface manually
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
