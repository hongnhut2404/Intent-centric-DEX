const { ethers } = require("hardhat");
const fs = require("fs");
const { createBuyIntent } = require("./utils/intentHelpers");

async function main() {
    const [_, user1] = await ethers.getSigners();
    const { address } = JSON.parse(fs.readFileSync("data/intent-matching-address.json"));
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const contract = await IntentMatching.attach(address);

    const locktime = Math.floor(Date.now() / 1000) + 3600;

    await createBuyIntent(contract, user1, 2, 10, locktime, "buy-eth");
    console.log("BuyIntent created by User1");
}

main().catch(console.error);
