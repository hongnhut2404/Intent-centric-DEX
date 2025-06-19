const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer, user1, user2, user3] = await ethers.getSigners();

    const authorizedUsers = [user1.address, user2.address, user3.address];
    const requiredApprovals = 2;

    const SecureMultiWallet = await ethers.getContractFactory("SecureMultiWallet");
    const multisig = await SecureMultiWallet.deploy(authorizedUsers, requiredApprovals);
    await multisig.waitForDeployment();

    const multisigAddress = await multisig.getAddress();
    console.log("SecureMultiWallet deployed to:", multisigAddress);

    // Save address to file
    const path = "data/secure-wallet-address.json";
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(path, JSON.stringify({ address: multisigAddress }, null, 2));
    console.log(`Multisig address saved to ${path}`);
}

main().catch((err) => {
    console.error("Deployment failed:", err.message);
    process.exit(1);
});
