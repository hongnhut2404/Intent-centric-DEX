const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const allSigners = await ethers.getSigners();

  // Load IntentMatching contract address
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const MultisigWallet = await ethers.getContractFactory("MultisigWallet");

  // Get deployed contract instances
  const intentMatching = IntentMatching.attach(intentMatchingAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  console.log("Multisig wallet (on-chain):", multisigAddress);

  const multisig = MultisigWallet.attach(multisigAddress);

  // Fetch owner addresses from on-chain and match with local signers
  const onChainOwners = await multisig.getOwners();
  const ownerSigners = onChainOwners
    .map(addr => allSigners.find(s => s.address.toLowerCase() === addr.toLowerCase()))
    .filter(Boolean);

  if (ownerSigners.length < onChainOwners.length) {
    console.warn("Some multisig owners are not available in local signers.");
  }

  const txCounter = await multisig.txCounter();

  for (let txId = 0; txId < txCounter; txId++) {
    const tx = await multisig.transactions(txId);
    if (tx.executed) {
      console.log(`Tx ${txId} already executed`);
      continue;
    }

    // Confirm with each available owner
    for (const signer of ownerSigners) {
      try {
        const confirmTx = await multisig.connect(signer).confirmTransaction(txId);
        await confirmTx.wait();
        console.log(`Tx ${txId} confirmed by ${signer.address}`);
      } catch (e) {
        if (e.message.includes("Already confirmed")) {
          console.log(`Tx ${txId} already confirmed by ${signer.address}`);
        } else {
          console.log(`Tx ${txId} confirmation by ${signer.address} failed: ${e.message}`);
        }
      }
    }

    // Attempt to execute the transaction (from first owner)
    try {
      const execTx = await multisig.connect(ownerSigners[0]).executeTransaction(txId);
      await execTx.wait();
      console.log(`Tx ${txId} executed`);
    } catch (e) {
      if (e.message.includes("Transaction already executed")) {
            console.log(`Tx ${txId} already executed automatically during confirmation`);
        } else {
            console.log(`Tx ${txId} execution failed: ${e.message}`);
        }
    }
  }

  console.log("✅ All pending SellIntents confirmed and executed (if eligible).");
}

main().catch(err => {
  console.error("Failed to confirm sell intents:", err);
  process.exit(1);
});
