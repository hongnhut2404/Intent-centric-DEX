const { ethers } = require("hardhat");
const fs = require("fs");
const { printAllIntents } = require("../utils/intentHelpers");

async function main() {
    const { address } = JSON.parse(fs.readFileSync("data/intent-matching-address.json"));
    const IntentMatching = await ethers.getContractFactory("IntentMatching");
    const contract = await IntentMatching.attach(address);

    await printAllIntents(contract);

}

main().catch(console.error);