const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = parseInt(process.env.BUY_ID || "0");

  const allSigners = await hre.ethers.getSigners();
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  const multisig = await MultisigWallet.attach(multisigAddress);

  // Fetch owners
  const owners = await multisig.getOwners();
  const ownerSigners = owners
    .map((addr) => allSigners.find((s) => s.address.toLowerCase() === addr.toLowerCase()))
    .filter(Boolean);

  if (ownerSigners.length !== owners.length) {
    console.warn("Some multisig owners are not available locally.");
  }

  const txCounter = await multisig.txCounter();
  const targetTxID = txCounter - 1n; // Assuming matchIntent is the most recent

  console.log(`Confirming TxID: ${targetTxID} with ${ownerSigners.length} owners`);

  for (const signer of ownerSigners) {
    try {
      const tx = await multisig.connect(signer).confirmTransaction(targetTxID);
      await tx.wait();
      console.log(`Tx ${targetTxID} confirmed by ${signer.address}`);
    } catch (err) {
      if ((err.message || "").includes("Already confirmed")) {
        console.log(`Tx ${targetTxID} already confirmed by ${signer.address}`);
      } else {
        console.warn(`Confirmation by ${signer.address} failed: ${err.message}`);
      }
    }
  }

  // Attempt execution
  try {
    const execTx = await multisig.connect(ownerSigners[0]).executeTransaction(targetTxID);
    const receipt = await execTx.wait();
    console.log(`Tx ${targetTxID} executed.`);

    const iface = intentMatching.interface;
    const logs = receipt.logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((e) => e.name === "TradeMatched");

    if (logs.length > 0) {
      console.log(`Recovered ${logs.length} TradeMatched events:`);
      for (const e of logs) {
        const t = e.args;
        console.log(`Matched:
  - BuyIntent ID: ${t.buyIntentId}
  - SellIntent ID: ${t.sellIntentId}
  - Executor: ${t.executor}
  - Buyer: ${t.buyer}
  - Seller: ${t.seller}
  - ETH: ${hre.ethers.formatEther(t.ethAmount)}
  - BTC: ${t.btcAmount}
  - Locktime: ${t.locktime}`);
      }
    } else {
      console.warn("No TradeMatched events found.");
    }
  } catch (err) {
    if ((err.message || "").includes("already executed")) {
      console.log(`Tx ${targetTxID} already executed.`);
    } else {
      console.error(`Execution failed: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
