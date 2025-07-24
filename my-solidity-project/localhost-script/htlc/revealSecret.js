// scripts/htlc/revealSecret.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto"); 


async function main() {
    const [signer] = await hre.ethers.getSigners();

    // Load IntentMatching contract address
    const intentPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
    const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentPath));

    // Attach to IntentMatching and fetch HTLC address
    const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
    const intentMatching = await IntentMatching.attach(intentMatchingAddress);
    const htlcAddress = await intentMatching.htlcAddress();

    // Load secret + lockId from exchange data
    const exchangePath = path.resolve(__dirname, "../../data/exchange-data.json");
    const exchangeData = JSON.parse(fs.readFileSync(exchangePath));
    const { htlcs } = exchangeData;

    if (!htlcs || htlcs.length === 0) throw new Error("No HTLCs found in exchange data");

    const HTLC = await hre.ethers.getContractFactory("HTLC");
    const htlc = await HTLC.attach(htlcAddress);


    for (const h of htlcs) {
        h.secret = h.secret.trim(); // Remove any accidental whitespace
        const actualSha256 = crypto.createHash("sha256").update(h.secret).digest("hex");
        console.log("Expected:", h.hashSha256);
        console.log("Actual  :", actualSha256);
        if (actualSha256 !== h.hashSha256) {
            throw new Error("Secret mismatch. The secret in exchange-data.json is invalid.");
        }
        console.log(`Broadcasting secret for lockId: ${h.lockId}`);
        const tx = await htlc.connect(signer).revealSecret(h.lockId, h.secret);
        await tx.wait();
        console.log(`Secret broadcasted: ${h.secret}`);
    }
}

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});
