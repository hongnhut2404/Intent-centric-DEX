const { ethers } = require("hardhat");
const fs = require("fs");
const { createSellIntent } = require("./utils/intentHelpers");

async function main() {
    const [_, __, user2] = await ethers.getSigners();
    const { address } = JSON.parse(fs.readFileSync("data/intent-matching-address.json"));
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const contract = await IntentMatching.attach(address);

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await createSellIntent(contract, user2, 0.1, 9, deadline, "sell-eth");
    await createSellIntent(contract, user2, 5, 1, deadline, "sell-eth");
    await createSellIntent(contract, user2, 20, 12, deadline, "sell-eth");

    console.log("SellIntents created by User2");
}

main().catch(console.error);
