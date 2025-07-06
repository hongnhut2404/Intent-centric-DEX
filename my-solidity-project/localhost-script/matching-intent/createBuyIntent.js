// scripts/createBuyIntent.js
const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
    const [_, user1] = await hre.ethers.getSigners();

    const { address } = JSON.parse(
        fs.readFileSync("data/intent-matching-address.json")
    );

    const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
    const contract = IntentMatching.attach(address);

    const locktime = Math.floor(Date.now() / 1000) + 3600;

    const offchainId = ethers.encodeBytes32String("buy-eth");

    const tx = await contract.connect(user1).createBuyIntent(
        2,
        10,
        locktime,
        offchainId
    );

    const receipt = await tx.wait();

    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === "BuyIntentCreated") {
                const { intentId, buyer, sellAmount, minBuyAmount, locktime } = parsed.args;
                console.log(`BuyIntent created:
  - id: ${intentId}
  - buyer: ${buyer}
  - sellAmount: ${sellAmount}
  - minBuyAmount: ${minBuyAmount}
  - locktime: ${locktime}
      `);
            }
        } catch (e) {
            // not matching event, skip
        }
    }

}

main().catch(console.error);
