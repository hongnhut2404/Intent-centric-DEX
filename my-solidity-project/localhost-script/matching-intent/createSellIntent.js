// scripts/createSellIntent.js
const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
    const [_, __, user2] = await hre.ethers.getSigners();

    const { address } = JSON.parse(
        fs.readFileSync("data/intent-matching-address.json")
    );

    console.log("Using IntentMatching contract at address:", address);

    const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
    const contract = IntentMatching.attach(address);

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const offchainId = ethers.encodeBytes32String("sell-eth");

    const tx = await contract.connect(user2).createSellIntent(
        15,
        9,
        deadline,
        offchainId
    );

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction mined in block ${receipt.blockNumber}`);

    if (!receipt.logs || receipt.logs.length === 0) {
        console.log("No logs found in transaction receipt. Maybe it reverted or no events emitted.");
        return;
    }

    console.log(`Logs found: ${receipt.logs.length}`);
    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);
            console.log("Parsed event:", parsed.name);

            if (parsed.name === "SellIntentCreated") {
                const {
                    intentId,
                    seller,
                    sellAmount,
                    minBuyAmount,
                    deadline: emittedDeadline,
                    offchainId
                } = parsed.args;

                console.log(`SellIntent created:
  - id: ${intentId}
  - seller: ${seller}
  - sellAmount: ${sellAmount}
  - minBuyAmount: ${minBuyAmount}
  - deadline: ${emittedDeadline}
                `);
            }
        } catch (e) {
            console.log("Unparsed log, skipping, reason:", e.message);
        }
    }
}

main().catch(console.error);
