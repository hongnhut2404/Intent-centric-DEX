const {ethers} = require('hardhat')

async function main(){
    //1. Setup accounts
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("Deployer address", deployer.address);
    console.log("User1 address", user1.address);
    console.log("User2 address", user2.address);
    
    //2. Deploy
    console.log("\nDeploying token A...");
    const tokenA = await ethers.getContractFactory("ERC20Token");
    const initialSupplyA = 50_000n * 10n ** 18n;
    const tokenAInstance = await tokenA.deploy("TokenA","TTA", initialSupplyA);
    await tokenAInstance.waitForDeployment();

    const tokenAAddress = await tokenAInstance.getAddress();
    const ownerAddressOfTokenA = await tokenAInstance.owner();
    console.log("Address of token A: ", tokenAAddress);
    console.log("Owner of Token A:", ownerAddressOfTokenA);

    //Deploy token B
    console.log("\nDeploying token B...");
    const tokenB = await ethers.getContractFactory("ERC20Token");
    const initialSupplyB = 50_000n * 10n ** 18n;
    const tokenBInstance = await tokenB.deploy("TokenB","TTB",initialSupplyB);
    await tokenBInstance.waitForDeployment();

    const tokenBAddress = await tokenBInstance.getAddress();
    const ownerAddressOfTokenB = await tokenBInstance.owner();
    console.log("Address of token B: ", tokenBAddress);
    console.log("Owner of Token B: ", ownerAddressOfTokenB);

    //Deploy Matching Version 1
    console.log("\nDeploying IntentMatching...");
    const IntentMaching = await ethers.getContractFactory("IntentMatchingVersion1");
    const intentMatching = await IntentMaching.deploy();
    await intentMatching.waitForDeployment();

    const intentMachingAddress = await intentMatching.getAddress();
    const ownerAddress = await intentMatching.owner();  
    console.log("Deployed to: ", intentMachingAddress);
    console.log("Owner of intentMaching: ", ownerAddress);

    //Create Buy Intent first
    
    
    
}
main().catch(error => {
    console.error("Error:", error.message);
    process.exit(1);
});