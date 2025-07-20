const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const buyIntentId = parseInt(process.env.BUY_ID);
  if (isNaN(buyIntentId)) {
    console.error("Usage: BUY_ID=<id> npx hardhat run ...");
    process.exit(1);
  }

  const allSigners = await ethers.getSigners();

  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );
  const IntentMatching = await ethers.getContractFactory("IntentMatching");
  const MultisigWallet = await ethers.getContractFactory("MultisigWallet");

  const intentMatching = IntentMatching.attach(intentMatchingAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  const multisig = MultisigWallet.attach(multisigAddress);

  console.log(`Multisig wallet (on-chain): ${multisigAddress}`);

  // Encode matchIntent call
  const data = intentMatching.interface.encodeFunctionData("matchIntent", [buyIntentId]);

  // Submit transaction
  const submitTx = await multisig
    .connect(allSigners[1])
    .submitTransaction(intentMatchingAddress, 0, data);
  const submitReceipt = await submitTx.wait();

  const parsedSubmitLog = submitReceipt.logs
    .map(log => {
      try {
        return multisig.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(log => log?.name === "TransactionSubmitted");

  if (!parsedSubmitLog) {
    console.error("Failed to extract txID from TransactionSubmitted event.");
    return;
  }

  const txID = parsedSubmitLog.args.txID;
  console.log(`matchIntent(${buyIntentId}) submitted via multisig. TxID: ${txID}`);

  const ownerAddresses = await multisig.getOwners();
  console.log(`Confirming TxID: ${txID} with ${ownerAddresses.length} owners`);

  for (let i = 0; i < ownerAddresses.length; i++) {
    const signer = allSigners.find(s => s.address === ownerAddresses[i]);
    if (!signer) continue;

    try {
      const confirmTx = await multisig.connect(signer).confirmTransaction(txID);
      await confirmTx.wait();
      console.log(`Tx ${txID} confirmed by owner ${i + 1} (${signer.address})`);
    } catch (err) {
      console.log(`Tx ${txID} already confirmed or failed by owner ${i + 1}: ${err.message}`);
    }
  }

  // Try execution
  try {
    const executor = allSigners.find(s => ownerAddresses.includes(s.address));
    const execTx = await multisig.connect(executor).executeTransaction(txID);
    const receipt = await execTx.wait();

    console.log(`Tx ${txID} executed successfully. Parsing events:`);

    for (const log of receipt.logs) {
      try {
        const parsed = intentMatching.interface.parseLog(log);
        if (parsed.name === "TradeMatched") {
          const [buyIntentId, sellIntentId, executor, seller, buyer, ethAmount, btcAmount, locktime] = parsed.args;

          console.log(`Matched:
  - BuyIntent ID: ${buyIntentId}
  - SellIntent ID: ${sellIntentId}
  - Executor: ${executor}
  - Buyer: ${buyer}
  - Seller: ${seller}
  - ETH: ${ethers.formatEther(ethAmount)}
  - BTC: ${Number(btcAmount) / 1e8}
  - Locktime: ${locktime}`);

        }
      } catch { }
    }
  } catch (e) {
    if (e.message.includes("Transaction already executed")) {
      console.log(`Tx ${txID} already executed automatically.`);

      const latestBlock = await ethers.provider.getBlockNumber();
      const matchedEvents = await intentMatching.queryFilter(
        intentMatching.filters.TradeMatched(),
        latestBlock - 10,  // scan last 10 blocks
        latestBlock
      );


      if (matchedEvents.length === 0) {
        console.log("No TradeMatched events found in recent block.");
      } else {
        console.log(`Recovered ${matchedEvents.length} TradeMatched events:`);

        for (const event of matchedEvents) {
          try {
            const parsed = intentMatching.interface.parseLog(event);
            const [buyIntentId, sellIntentId, executor, seller, buyer, ethAmount, btcAmount, locktime] = parsed.args;

            console.log(`Matched:
              - BuyIntent ID: ${buyIntentId}
              - SellIntent ID: ${sellIntentId}
              - Executor: ${executor}
              - Buyer: ${buyer}
              - Seller: ${seller}
              - ETH: ${ethers.formatEther(ethAmount)}
              - BTC: ${Number(btcAmount) / 1e8}
              - Locktime: ${locktime}`);
          } catch (e) {
            console.warn(`Failed to parse log: ${e.message}`);
          }
        }

      }
    } else {
      console.error(`Tx ${txID} execution failed: ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
