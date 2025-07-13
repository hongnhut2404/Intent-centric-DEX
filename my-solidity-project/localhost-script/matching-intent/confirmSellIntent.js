const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer, owner1, owner2] = await ethers.getSigners();

  // Load IntentMatching address
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const MultisigWallet = await ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  console.log("Multisig wallet (on-chain):", multisigAddress);

  const multisig = await MultisigWallet.attach(multisigAddress);

  // Get current tx count
  const txCounter = await multisig.txCounter();

  for (let txId = 0; txId < txCounter; txId++) {
    const tx = await multisig.transactions(txId);

    if (tx.executed) {
      console.log(`Tx ${txId} already executed ✅`);
      continue;
    }

    // Confirm from owner1
    try {
      const tx1 = await multisig.connect(owner1).confirmTransaction(txId);
      await tx1.wait();
      console.log(`Tx ${txId} confirmed by owner1`);
    } catch (e) {
      console.log(`Tx ${txId} already confirmed by owner1 or failed: ${e.message}`);
    }

    // Confirm from owner2
    try {
      const tx2 = await multisig.connect(owner2).confirmTransaction(txId);
      await tx2.wait();
      console.log(`Tx ${txId} confirmed by owner2`);
    } catch (e) {
      console.log(`Tx ${txId} already confirmed by owner2 or failed: ${e.message}`);
    }

    // Fetch updated tx state
    const updatedTx = await multisig.transactions(txId);
    if (!updatedTx.executed && updatedTx.confirmationCount.toNumber() === 2) {
      try {
        const exec = await multisig.connect(owner1).executeTransaction(txId);
        await exec.wait();
        console.log(`Tx ${txId} executed ✅`);
      } catch (e) {
        console.log(`Tx ${txId} execution failed: ${e.message}`);
      }
    } else if (updatedTx.executed) {
      console.log(`Tx ${txId} already executed ✅`);
    } else {
      console.log(`Tx ${txId} not executed (not enough confirmations yet)`);
    }
  }

  console.log("All pending SellIntents confirmed and executed (if eligible).");
}

main().catch((err) => {
  console.error("Failed to confirm sell intents:", err);
  process.exit(1);
});
