const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const intentMatching = await IntentMatching.deploy();
    await intentMatching.waitForDeployment();

    const address = await intentMatching.getAddress();
    console.log("IntentMatching deployed to:", address);

    fs.writeFileSync("data/intent-matching-address.json", JSON.stringify({ address }, null, 2));
    console.log("Address written to data/intent-matching-address.json");
}

main().catch((err) => {
    console.error("Deploy failed:", err.message);
    process.exit(1);
});
