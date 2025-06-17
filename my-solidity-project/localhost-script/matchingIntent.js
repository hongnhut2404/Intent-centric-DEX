const fs = require("fs");
const { ethers } = require("hardhat");

async function createBuyIntent(intentMatching, user, sellAmountBTC, minETHWanted, locktime, offchainIdStr) {
    const offchainId = ethers.keccak256(ethers.toUtf8Bytes(offchainIdStr));
    const tx = await intentMatching.connect(user).createBuyIntent(
        sellAmountBTC,
        ethers.parseEther(minETHWanted.toString()),
        locktime,
        offchainId
    );
    await tx.wait();
    console.log(`BuyIntent created by ${user.address}`);
}

async function createSellIntent(intentMatching, user, ethAmount, minBTCExpected, deadline, offchainIdStr) {
    const offchainId = ethers.keccak256(ethers.toUtf8Bytes(offchainIdStr));
    const tx = await intentMatching.connect(user).createSellIntent(
        ethers.parseEther(ethAmount.toString()),
        minBTCExpected,
        deadline,
        offchainId
    );
    await tx.wait();
    console.log(`SellIntent created by ${user.address}: ${ethAmount} ETH for ${minBTCExpected / 1e8} BTC`);
}


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
    const locktime = Math.floor(Date.now() / 1000) + 3600;

    await createBuyIntent(intentMatching, user1, 200_000_000, 10, locktime, "buy-eth");
    console.log("BuyIntent created by User1");

    // Create SellIntent (user2 will lock ETH, expects BTC)
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const offchainIdSell = ethers.keccak256(ethers.toUtf8Bytes("sell-eth"));

    await createSellIntent(intentMatching, user2, 20, 900_000_000, deadline, "sell-eth");
    await createSellIntent(intentMatching, user2, 5, 100_000_000, deadline, "sell-eth");
    await createSellIntent(intentMatching, user2, 20, 1_200_000_000, deadline, "sell-eth");

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
                    locktime: locktime.toString()
                };

                console.log("TradeExecuted Event:", output);

                // Write to file (optional)
                fs.writeFileSync("data/trade-executed.json", JSON.stringify(output, null, 2));
                console.log("Event written to data/trade-executed.json");

                const htlcData = {
                    htlcAddress: contractAddress, // Assuming it's done in this contract
                    senderAddress: sender,
                    recipientAddress: recipient,
                    timelock: Number(locktime),
                    amount: amountETH.toString(), // ETH being locked
                };

                fs.writeFileSync("data/htlc-initiate.json", JSON.stringify(htlcData, null, 2));
                console.log("HTLC data written to data/htlc-initiate.json");
            }
        } catch (err) {
            // Ignore logs that can't be parsed (non-matching topics)
            console.error("Log parsing error:", err.message);
        }
    }

}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
