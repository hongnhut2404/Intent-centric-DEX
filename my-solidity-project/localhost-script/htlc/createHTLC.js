// scripts/htlc/createHTLC.js
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = 0;
  const allSigners = await hre.ethers.getSigners();

  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();
  const multisigAddress = await intentMatching.multisigWallet();

  const htlc = await HTLC.attach(htlcAddress);
  const multisig = await MultisigWallet.attach(multisigAddress);

  const ownerAddresses = await multisig.getOwners();
  const localOwners = ownerAddresses
    .map(addr => allSigners.find(s => s.address.toLowerCase() === addr.toLowerCase()))
    .filter(Boolean);

  const threshold = await multisig.required();
  if (localOwners.length < threshold) throw new Error(`Need ${threshold} owners, found ${localOwners.length}`);

  const matchedTradeCount = await intentMatching.matchedTradeCount();
  if (matchedTradeCount === 0n) throw new Error("No matched trades found");

  const secret = "mysecret" + Date.now();
  const hashKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret));
  const hashSha256 = crypto.createHash("sha256").update(secret).digest("hex");

  let created = 0;
  let associated = 0;

  for (let i = 0n; i < matchedTradeCount; i++) {
    const trade = await intentMatching.matchedTrades(i);
    if (trade.buyIntentId !== BigInt(buyIntentId)) continue;

    const calldata = htlc.interface.encodeFunctionData("newLock", [
      trade.recipient,
      hashKeccak,
      trade.locktime,
    ]);

    let txID;
    try {
      const submitTx = await multisig.connect(localOwners[0]).submitTransaction(htlcAddress, trade.ethAmount, calldata);
      const receipt = await submitTx.wait();
      const event = receipt.logs
        .map(log => { try { return multisig.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TransactionSubmitted");
      if (!event) throw new Error("No TransactionSubmitted event");
      txID = event.args.txID;
    } catch (err) {
      continue;
    }

    for (let j = 0; j < threshold; j++) {
      try {
        await multisig.connect(localOwners[j]).confirmTransaction(txID);
      } catch {}
    }

    let execReceipt;
    try {
      const execTx = await multisig.connect(localOwners[0]).executeTransaction(txID);
      execReceipt = await execTx.wait();
      created++;
    } catch {
      continue;
    }

    const lockedEvent = execReceipt.logs
      .map(log => { try { return htlc.interface.parseLog(log); } catch { return null; } })
      .find(e => e?.name === "Locked");
    if (!lockedEvent) continue;

    const lockId = lockedEvent.args.id;

    const associateCalldata = intentMatching.interface.encodeFunctionData("associateHTLC", [
      buyIntentId,
      lockId,
      trade.recipient,
      hashKeccak,
    ]);

    let associateTxID;
    try {
      const submit2 = await multisig.connect(localOwners[0]).submitTransaction(intentMatchingAddress, 0, associateCalldata);
      const receipt2 = await submit2.wait();
      const event2 = receipt2.logs
        .map(log => { try { return multisig.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === "TransactionSubmitted");
      if (!event2) throw new Error("No TransactionSubmitted event for associateHTLC");
      associateTxID = event2.args.txID;
    } catch {
      continue;
    }

    for (let j = 0; j < threshold; j++) {
      try {
        await multisig.connect(localOwners[j]).confirmTransaction(associateTxID);
      } catch {}
    }

    try {
      const exec2 = await multisig.connect(localOwners[0]).executeTransaction(associateTxID);
      await exec2.wait();
      associated++;
    } catch {}
  }

  console.log("\nSummary:");
  console.log(`${created} HTLC(s) locked on-chain for BuyIntent ${buyIntentId}`);
  console.log(`${associated} HTLC(s) successfully associated`);
  if (created > 0) {
    console.log("Shared Secret:", secret);
    console.log("Keccak256 (ETH):", hashKeccak);
    console.log("SHA256 (BTC):", hashSha256);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
