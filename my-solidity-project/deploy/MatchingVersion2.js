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
    const IntentMaching = await ethers.getContractFactory("IntentMatchingVersion2");
    const intentMatching = await IntentMaching.deploy();
    await intentMatching.waitForDeployment();

    const intentMachingAddress = await intentMatching.getAddress();
    const ownerAddress = await intentMatching.owner();  
    console.log("Deployed to: ", intentMachingAddress);
    console.log("Owner of intentMaching: ", ownerAddress);

    //Create Buy Intent first
    const buyAmount = 100n * 10n ** 18n;
    const minAmountInBuy = 200n * 10n ** 18n;
    await tokenAInstance.connect(user1).approve(intentMachingAddress, buyAmount);

    await intentMatching.connect(user1).createBuyIntent(
        tokenAAddress, 
        tokenBAddress,
        buyAmount,
        minAmountInBuy,
        Math.floor(Date.now() / 1000) + 3600
    )
    // console.log("Buy Intent: 100 TTA → min 200 TTB");
    // const buyIntent = await intentMatching.getBuyIntent(0);
    // console.log("Buy Intent Details:", {
    //     user: buyIntent.user,
    //     tokenIn: buyIntent.tokenIn,
    //     tokenOut: buyIntent.tokenOut,
    //     amountIn: ethers.formatEther(buyIntent.amountIn),
    //     minAmountOut: ethers.formatEther(buyIntent.minAmountOut),
    //     status: ["Pending", "Filled", "Cancelled"][buyIntent.status]
    // });

    //Create sell intent second
    const sellAmount = 200n * 10n ** 18n;
    const minAmountInSell = 100n * 10n ** 18n;
    await tokenBInstance.connect(user2).approve(intentMachingAddress, sellAmount);

    await intentMatching.connect(user2).createSellIntent(
        tokenBAddress, 
        tokenAAddress,
        sellAmount,
        minAmountInSell,
        Math.floor(Date.now() / 1000) + 3600
    )

    await intentMatching.connect(user2).createSellIntent(
        tokenBAddress, 
        tokenAAddress,
        100n * 10n ** 18n,
        50n * 10n ** 18n,
        Math.floor(Date.now() / 1000) + 3600
    )

    await intentMatching.connect(user2).createSellIntent(
        tokenBAddress, 
        tokenAAddress,
        50n * 10n ** 18n,
        25n * 10n ** 18n,
        Math.floor(Date.now() / 1000) + 3600
    )
    
    //Distribute tokens: TokenA -> User1, TokenB -> User2
    console.log("\nDistributing test tokens...");
    const distributeAmount = 500n * 10n ** 18n;

    await tokenAInstance.transfer(user1.address, distributeAmount);
    await tokenBInstance.transfer(user2.address, distributeAmount);

    console.log(`Sent ${ethers.formatEther(distributeAmount)} TokenA to User1`);
    console.log(`Sent ${ethers.formatEther(distributeAmount)} TokenB to User2`);

    //Before match
    console.log("\nPre-Match Balances:");
    console.log("User1 TTA:", ethers.formatEther(await tokenAInstance.balanceOf(user1.address)));
    console.log("User1 TTB:", ethers.formatEther(await tokenBInstance.balanceOf(user1.address)));
    console.log("User2 TTA:", ethers.formatEther(await tokenAInstance.balanceOf(user2.address)));
    console.log("User2 TTB:", ethers.formatEther(await tokenBInstance.balanceOf(user2.address)));

    console.log("\nMatching intents...");
    const matchTx = await intentMatching.matchIntent(
        0 // buyIntentId
    );
    await matchTx.wait();
    console.log("Intents matched successfully!");

    //After match
    console.log("\nAfter-Match Balances:");
    console.log("User1 TTA:", ethers.formatEther(await tokenAInstance.balanceOf(user1.address)));
    console.log("User1 TTB:", ethers.formatEther(await tokenBInstance.balanceOf(user1.address)));
    console.log("User2 TTA:", ethers.formatEther(await tokenAInstance.balanceOf(user2.address)));
    console.log("User2 TTB:", ethers.formatEther(await tokenBInstance.balanceOf(user2.address)));
}
main().catch(error => {
    console.error("Error:", error.message);
    process.exit(1);
});