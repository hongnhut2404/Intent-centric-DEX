const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const allSigners = await ethers.getSigners();

  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );
  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const intentMatching = await IntentMatching.attach(intentMatchingAddress);

  const multisigAddress = await intentMatching.multisigWallet();
  const MultisigWallet = await ethers.getContractFactory("MultisigWallet");
  const multisig = await MultisigWallet.attach(multisigAddress);

  const txId = parseInt(process.env.TX_ID);
  if (isNaN(txId)) {
    console.error("Please provide TX_ID as an environment variable.");
    process.exit(1);
  }

  const ownerAddresses = await multisig.getOwners();
  console.log(`Multisig wallet (on-chain): ${multisigAddress}`);
  console.log(`Confirming TxID: ${txId} with ${ownerAddresses.length} owners`);

  for (let i = 0; i < ownerAddresses.length; i++) {
    const addr = ownerAddresses[i];
    const signer = allSigners.find((s) => s.address === addr);

    if (!signer) {
      console.warn(`Signer for owner ${addr} not found in local accounts`);
      continue;
    }

    try {
      const tx = await multisig.connect(signer).confirmTransaction(txId);
      await tx.wait();
      console.log(`Tx ${txId} confirmed by owner ${i + 1} (${addr})`);
    } catch (e) {
      console.log(`Tx ${txId} already confirmed by owner ${i + 1} or failed: ${e.message}`);
    }
  }

  const { executed } = await multisig.transactions(txId);
  const executor = allSigners.find((s) => ownerAddresses.includes(s.address));

  if (!executor) {
    console.error("No valid signer available to execute the transaction.");
    process.exit(1);
  }

  if (!executed) {
    try {
      const execTx = await multisig.connect(executor).executeTransaction(txId);
      const receipt = await execTx.wait();

      const blockNumber = receipt.blockNumber;
      console.log(`Tx ${txId} executed successfully in block ${blockNumber}.`);

      // Query TradeMatched events in that block
      const events = await intentMatching.queryFilter(
        intentMatching.filters.TradeMatched(),
        blockNumber,
        blockNumber
      );

      if (events.length === 0) {
        console.log("No TradeMatched events found in execution block.");
      } else {
        console.log(`Recovered ${events.length} TradeMatched events:`);
        for (const event of events) {
          const { buyIntentId, sellIntentId, recipient, sender, ethAmount, btcAmount, locktime } = event.args;

          console.log(`Matched:
  - BuyIntent ID: ${buyIntentId}
  - SellIntent ID: ${sellIntentId}
  - Buyer: ${recipient}
  - Seller: ${sender}
  - ETH: ${ethers.formatEther(ethAmount)}
  - BTC: ${Number(btcAmount) / 1e8}
  - Locktime: ${locktime}`);
        }
      }

      return;
    } catch (e) {
      console.error(`Tx ${txId} execution failed: ${e.message}`);
      return;
    }
  }

  // Fallback if already executed earlier
  console.log(`Tx ${txId} already executed automatically during confirmation.`);

  // Try recovering matched trades by scanning recent blocks
  const latestBlock = await ethers.provider.getBlockNumber();
  const matchedEvents = await intentMatching.queryFilter(
    intentMatching.filters.TradeMatched(),
    latestBlock - 10,
    latestBlock
  );

  if (matchedEvents.length === 0) {
    console.log("No TradeMatched events found in recent blocks.");
  } else {
    console.log(`Recovered ${matchedEvents.length} TradeMatched events from recent blocks:`);
    for (const event of matchedEvents) {
      const { buyIntentId, sellIntentId, recipient, sender, ethAmount, btcAmount, locktime } = event.args;

      console.log(`Matched:
  - BuyIntent ID: ${buyIntentId}
  - SellIntent ID: ${sellIntentId}
  - Buyer: ${recipient}
  - Seller: ${sender}
  - ETH: ${ethers.formatEther(ethAmount)}
  - BTC: ${Number(btcAmount) / 1e8}
  - Locktime: ${locktime}`);
    }
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
