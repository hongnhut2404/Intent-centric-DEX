const hre = require("hardhat");
const readline = require("readline-sync");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = 0; // Change this as needed

  const secret = readline.question("Enter the shared secret preimage: ");
  const secretHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret));

  // Load IntentMatching contract
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();
  const htlc = await HTLC.attach(htlcAddress);

  // Query HTLCAssociated events for this BuyIntent
  const filter = intentMatching.filters.HTLCAssociated(buyIntentId);
  const events = await intentMatching.queryFilter(filter);

  if (events.length === 0) {
    console.log("No HTLCs associated with this BuyIntent.");
    return;
  }

  let successCount = 0;

  for (const event of events) {
    const { lockId, recipient } = event.args;

    const signer = await hre.ethers.getSigner(recipient);
    const balanceBefore = await hre.ethers.provider.getBalance(recipient);

    console.log(`Withdrawing HTLC for lockId: ${lockId}`);
    console.log("Recipient:", recipient);
    console.log("Balance before:", hre.ethers.formatEther(balanceBefore), "ETH");

    try {
      const tx = await htlc.connect(signer).withdraw(lockId, secret);
      await tx.wait();

      const balanceAfter = await hre.ethers.provider.getBalance(recipient);
      console.log("Withdrawal successful.");
      console.log("Balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
      successCount++;
    } catch (err) {
      console.error("Withdrawal failed:", err.reason || err.message);
    }
  }

  if (successCount === 0) {
    console.log("No HTLCs withdrawn.");
  } else {
    console.log(`Withdrawn ${successCount} HTLC(s) for BuyIntent ${buyIntentId}.`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
