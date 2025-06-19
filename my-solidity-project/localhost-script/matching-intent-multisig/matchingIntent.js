const fs = require("fs");
const { ethers } = require("hardhat");
const { createBuyIntent, printAllIntents } = require("../utils/intentHelpers");

async function main() {
    const [deployer, user1, approver1, approver2] = await ethers.getSigners();

    console.log("Deployer:", deployer.address);
    console.log("User1:", user1.address);
    console.log("Approver1:", approver1.address);
    console.log("Approver2:", approver2.address);

    // Deploy IntentMatching
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const intentMatching = await IntentMatching.deploy();
    await intentMatching.waitForDeployment();
    const intentMatchingAddress = await intentMatching.getAddress();
    console.log("IntentMatching deployed to:", intentMatchingAddress);

    // Load deployed multisig
    const secureWalletAddr = JSON.parse(fs.readFileSync("data/secure-wallet-address.json")).address;
    const SecureMultiWallet = await ethers.getContractFactory("SecureMultiWallet");
    const multisig = await SecureMultiWallet.attach(secureWalletAddr);

    // Create BuyIntent from user1
    const locktime = Math.floor(Date.now() / 1000) + 3600;
    await createBuyIntent(intentMatching, user1, 2, 10, locktime, "buy-eth");
    console.log("BuyIntent created by User1");

    const iface = new ethers.utils.Interface([
        "function createSellIntent(uint256,uint256,uint256,string)"
    ]);

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // ========== Submit SellIntents through multisig ==========
    const sellIntents = [
        { amountIn: 15, minOut: 9, label: "sell-eth" },
        { amountIn: 5, minOut: 1, label: "sell-eth" },
        { amountIn: 20, minOut: 12, label: "sell-eth" },
    ];

    const txIDs = [];

    for (let i = 0; i < sellIntents.length; i++) {
        const { amountIn, minOut, label } = sellIntents[i];
        const payload = iface.encodeFunctionData("createSellIntent", [
            ethers.utils.parseEther(amountIn.toString()), // amountIn in ETH
            minOut,
            deadline,
            label
        ]);

        const tx = await multisig.connect(approver1).addTransaction(
            intentMatchingAddress,
            ethers.utils.parseEther(amountIn.toString()),
            payload
        );
        const receipt = await tx.wait();

        const txID = i; // or parse from event log
        console.log(`SellIntent TX ${i} submitted via multisig`);
        txIDs.push(txID);
    }

    // Approve and execute each multisig transaction
    for (const txID of txIDs) {
        await multisig.connect(approver2).approveTransaction(txID);
        console.log(`TX ${txID} approved by approver2`);

        await multisig.connect(approver1).runTransaction(txID);
        console.log(`TX ${txID} executed via multisig`);
    }

    // ====== Print all intents ======
    await printAllIntents(intentMatching);

    // ====== Match intent (user1 is buyer) ======
    console.log("\nMatching intents...");
    const matchTx = await intentMatching.matchIntent(0); // buyIntentId = 0
    const receipt = await matchTx.wait();
    console.log("Intents matched successfully!");

    // ====== Parse TradeExecuted event ======
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
                fs.writeFileSync("data/trade-executed.json", JSON.stringify(output, null, 2));

                const htlcData = {
                    htlcAddress: intentMatchingAddress,
                    senderAddress: sender,
                    recipientAddress: recipient,
                    timelock: Number(locktime),
                    amount: amountETH.toString()
                };
                fs.writeFileSync("data/htlc-initiate.json", JSON.stringify(htlcData, null, 2));
            }
        } catch (err) {
            console.error("Log parsing error:", err.message);
        }
    }
}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
