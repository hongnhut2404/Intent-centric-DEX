const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const { address } = JSON.parse(fs.readFileSync("data/intent-matching-address.json"));
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const contract = await IntentMatching.attach(address);

    console.log("Matching intents...");
    const matchTx = await contract.matchIntent(0);
    const receipt = await matchTx.wait();

    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === "TradeMatched") {
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

                fs.writeFileSync("data/trade-executed.json", JSON.stringify(output, null, 2));
                console.log("Event written to data/trade-executed.json");

                const htlcData = {
                    htlcAddress: address,
                    senderAddress: sender,
                    recipientAddress: recipient,
                    timelock: Number(locktime),
                    amount: amountETH.toString()
                };

                fs.writeFileSync("data/htlc-initiate.json", JSON.stringify(htlcData, null, 2));
                console.log("HTLC data written to data/htlc-initiate.json");
            }
        } catch (err) {
            console.error("Log parsing error:", err.message);
        }
    }
}

main().catch(console.error);

