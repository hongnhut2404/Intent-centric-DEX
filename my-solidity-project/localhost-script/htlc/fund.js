// fundMultisig.js
const hre = require("hardhat");

async function main() {
    const [sender] = await hre.ethers.getSigners();

    const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
    const { address: intentMatchingAddress } = require("../../data/intent-matching-address.json");
    const intentMatching = await IntentMatching.attach(intentMatchingAddress);
    const multisigAddr = await intentMatching.multisigWallet();

    const tx = await sender.sendTransaction({
        to: multisigAddr,
        value: hre.ethers.parseEther("10.0")
    });

    await tx.wait();
    console.log("Multisig funded:", tx.hash);
    const balance = await hre.ethers.provider.getBalance(multisigAddr);
    console.log("Multisig balance:", hre.ethers.formatEther(balance), "ETH");

}

main();
