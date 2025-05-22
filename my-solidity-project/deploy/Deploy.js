const { ethers } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy TokenA
    console.log("\nDeploying TokenA...");
    const Token = await ethers.getContractFactory("ERC20Token");
    const initialSupplyA = ethers.parseEther("50000"); // 50,000 TTA
    const tokenA = await Token.deploy("TokenA", "TTA", initialSupplyA);
    await tokenA.waitForDeployment();
    const tokenAAddress = await tokenA.getAddress();
    console.log("TokenA deployed to:", tokenAAddress);

    // Deploy TokenB
    console.log("\nDeploying TokenB...");
    const initialSupplyB = ethers.parseEther("50000"); // 50,000 TTB
    const tokenB = await Token.deploy("TokenB", "TTB", initialSupplyB);
    await tokenB.waitForDeployment();
    const tokenBAddress = await tokenB.getAddress();
    console.log("TokenB deployed to:", tokenBAddress);

    // Deploy IntentMatchingVersion2
    console.log("\nDeploying IntentMatchingVersion2...");
    const IntentMatching = await ethers.getContractFactory("IntentMatchingVersion2");
    const intentMatching = await IntentMatching.deploy();
    await intentMatching.waitForDeployment();
    const intentMatchingAddress = await intentMatching.getAddress();
    console.log("IntentMatchingVersion2 deployed to:", intentMatchingAddress);

    // Save addresses for frontend
    console.log("\nContract Addresses:");
    console.log(`TokenA: ${tokenAAddress}`);
    console.log(`TokenB: ${tokenBAddress}`);
    console.log(`IntentMatching: ${intentMatchingAddress}`);
}

main().catch(error => {
    console.error("Error:", error.message);
    process.exit(1);
});