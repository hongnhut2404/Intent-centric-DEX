const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);

    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const intentMatching = await IntentMatching.deploy();
    await intentMatching.waitForDeployment();

    const contractAddress = await intentMatching.getAddress();
    console.log("IntentMatching deployed to:", contractAddress);

    // Create BuyIntent (user1 wants ETH, offers BTC off-chain)
    const buySellAmountBTC = 200_000_000; // e.g. 20 BTC
    const minETHWanted = ethers.parseEther("10");
    const locktime = Math.floor(Date.now() / 1000) + 3600;
    const offchainIdBuy = ethers.keccak256(ethers.toUtf8Bytes("buy-eth"));

    await intentMatching.connect(user1).createBuyIntent(
        buySellAmountBTC,
        minETHWanted,
        locktime,
        offchainIdBuy
    );
    console.log("BuyIntent created by User1");

    // Create SellIntent (user2 will lock ETH, expects BTC)
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const offchainIdSell = ethers.keccak256(ethers.toUtf8Bytes("sell-eth"));

    await intentMatching.connect(user2).createSellIntent(
        ethers.parseEther("20"),
        900_000_000,
        deadline,
        offchainIdSell
    );
    await intentMatching.connect(user2).createSellIntent(
        ethers.parseEther("5"),
        100_000_000,
        deadline,
        offchainIdSell
    );
    await intentMatching.connect(user2).createSellIntent(
        ethers.parseEther("20"),
        1_200_000_000,
        deadline,
        offchainIdSell
    );
    console.log("SellIntent created by User2");

    console.log("\nMatching intents...");
    const matchTx = await intentMatching.matchIntent(
        0 // buyIntentId
    );
    const receipt = await matchTx.wait();
    console.log("Intents matched successfully!");

    // Parse the TradeExecuted event from the receipt
    for (const log of receipt.logs) {
        try {
            const parsed = intentMatching.interface.parseLog(log);
            if (parsed.name === "TradeExecuted") {
                const [buyIntentId, sellIntentId, recipient, token, sender, amountETH, amountBTC, locktime] = parsed.args;
                const output = {
                    buyIntentId: Number(buyIntentId),
                    sellIntentId: Number(sellIntentId),
                    recipient,
                    token,
                    sender,
                    amountETH: amountETH.toString(),
                    amountBTC: amountBTC.toString(),
                    locktime
                };

                console.log("TradeExecuted Event:", output);

                // Write to file (optional)
                fs.writeFileSync("data/trade-executed.json", JSON.stringify(output, null, 2));
                console.log("Event written to data/trade-executed.json");
            }
        } catch (err) {
            // Ignore logs that can't be parsed (non-matching topics)
        }
    }

}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
