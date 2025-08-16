// scripts/htlc/createHTLC.js
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// --- helpers ---
function getBuyIdOrDefault() {
  // priority: env -> argv[2] -> 0
  const envId = process.env.BUY_ID;
  if (envId !== undefined && envId !== "") {
    const n = parseInt(envId, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  if (process.argv[2] !== undefined) {
    const n = parseInt(process.argv[2], 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return 0;
}

function generateRandomSecret(len = 12) {
  const bytes = crypto.randomBytes(len);
  // base64-url-ish (no +/), or just hex if you prefer
  return bytes.toString("base64url");
}

function bn(x) {
  return typeof x === "bigint" ? x : BigInt(x.toString());
}

async function main() {
  const buyIntentId = getBuyIdOrDefault();
  console.log(`Using BUY_ID = ${buyIntentId}`);

  // --- wire up contracts/addresses ---
  const allSigners = await hre.ethers.getSigners();

  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  if (!fs.existsSync(intentJsonPath)) {
    throw new Error("intent-matching-address.json not found");
  }
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath, "utf8"));
  if (!intentMatchingAddress) throw new Error("IntentMatching address missing in JSON");

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);

  const htlcAddress = await intentMatching.htlcAddress();
  if (!htlcAddress || htlcAddress === hre.ethers.ZeroAddress) {
    throw new Error("HTLC address is not set on IntentMatching. Deploy + set it first.");
  }

  const multisigAddress = await intentMatching.multisigWallet();
  if (!multisigAddress || multisigAddress === hre.ethers.ZeroAddress) {
    throw new Error("Multisig wallet is not set on IntentMatching. Deploy + set it first.");
  }

  console.log("IntentMatching:", intentMatchingAddress);
  console.log("HTLC:", htlcAddress);
  console.log("Multisig:", multisigAddress);

  const htlc = await HTLC.attach(htlcAddress);
  const multisig = await MultisigWallet.attach(multisigAddress);

  // --- owners & threshold ---
  const ownerAddresses = await multisig.getOwners();
  const threshold = await multisig.required();
  const localOwners = ownerAddresses
    .map(addr => allSigners.find(s => s.address.toLowerCase() === addr.toLowerCase()))
    .filter(Boolean);

  if (localOwners.length < Number(threshold)) {
    throw new Error(`Need ${threshold} owners available locally, found ${localOwners.length}`);
  }

  // --- gather trades for this buyIntentId ---
  const matchedTradeCount = await intentMatching.matchedTradeCount();
  if (matchedTradeCount === 0n) throw new Error("No matched trades found");

  const trades = [];
  for (let i = 0n; i < matchedTradeCount; i++) {
    const t = await intentMatching.matchedTrades(i);
    if (t.buyIntentId === BigInt(buyIntentId)) trades.push({ idx: i, t });
  }

  if (trades.length === 0) {
    console.log(`No matched trades for BUY_ID=${buyIntentId}`);
    return;
  }

  // skip zero-ETH partials and pre-sum ETH needed
  let totalEthNeeded = 0n;
  const usable = [];
  for (const { idx, t } of trades) {
    if (bn(t.ethAmount) === 0n) {
      console.log(`Skipping trade #${idx} (ethAmount == 0)`);
      continue;
    }
    usable.push({ idx, t });
    totalEthNeeded += bn(t.ethAmount);
  }

  if (usable.length === 0) {
    console.log("All matched trades have 0 ETH (likely rounding). Nothing to lock.");
    return;
  }

  // --- pre-check multisig balance ---
  const msigBal = await hre.ethers.provider.getBalance(multisigAddress);
  if (msigBal < totalEthNeeded) {
    console.warn(`⚠️ Multisig balance ${hre.ethers.formatEther(msigBal)} ETH < needed ${hre.ethers.formatEther(totalEthNeeded)} ETH`);
    console.warn("Proceeding best-effort (some locks may fail). Consider funding the multisig first.");
  }

  // --- base secret, then derive per-trade salt/hashes ---
  const baseSecret = generateRandomSecret(12);
  const baseKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(baseSecret));

  const htlcMetadata = [];
  let created = 0;
  let associated = 0;

  console.log(`\nWill attempt HTLCs for ${usable.length} trade(s).`);

  for (const { idx, t } of usable) {
    // per-trade salted hashes (avoid duplicate-lock reverts)
    const perTradeKeccak = hre.ethers.keccak256(
      hre.ethers.solidityPacked(["bytes32", "uint256"], [baseKeccak, idx])
    );
    const perTradeSha256 = crypto
      .createHash("sha256")
      .update(`${baseSecret}#${idx.toString()}`)
      .digest("hex");

    // 1) submit newLock (value = ethAmount)
    const calldata = htlc.interface.encodeFunctionData("newLock", [
      t.recipient,
      perTradeKeccak,
      t.locktime,
    ]);

    let txID;
    try {
      const submitTx = await multisig
        .connect(localOwners[0])
        .submitTransaction(htlcAddress, bn(t.ethAmount), calldata);
      const receipt = await submitTx.wait();

      const subEv = receipt.logs
        .map(l => { try { return multisig.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "TransactionSubmitted");
      if (!subEv) throw new Error("No TransactionSubmitted event on newLock submit");
      txID = subEv.args.txID;
    } catch (err) {
      console.error(`❌ Submit newLock failed for trade #${idx}:`, err?.error?.error?.message || err?.message || err);
      continue;
    }

    // 2) confirm threshold
    for (let j = 0; j < Number(threshold); j++) {
      try {
        await multisig.connect(localOwners[j]).confirmTransaction(txID);
      } catch (err) {
        // often "Already confirmed"; safe to ignore
      }
    }

    // 3) execute
    let execReceipt;
    try {
      const execTx = await multisig.connect(localOwners[0]).executeTransaction(txID);
      execReceipt = await execTx.wait();
      created++;
    } catch (err) {
      console.error(`❌ Execute newLock failed for trade #${idx}, txID ${txID}:`,
        err?.error?.error?.message || err?.message || err);
      continue;
    }

    // 4) parse Locked event for lockId
    const lockedEvent = execReceipt.logs
      .map(l => { try { return htlc.interface.parseLog(l); } catch { return null; } })
      .find(e => e?.name === "Locked");

    if (!lockedEvent) {
      console.warn(`⚠️ No Locked event for trade #${idx} (txID ${txID}). Skipping association.`);
      continue;
    }

    const lockId = lockedEvent.args.id;

    // 5) associateHTLC on IntentMatching via multisig
    const associateCalldata = intentMatching.interface.encodeFunctionData("associateHTLC", [
      buyIntentId,
      lockId,
      t.recipient,
      perTradeKeccak,
    ]);

    let assocTxID;
    try {
      const submitAssoc = await multisig
        .connect(localOwners[0])
        .submitTransaction(intentMatchingAddress, 0, associateCalldata);
      const r2 = await submitAssoc.wait();
      const ev2 = r2.logs
        .map(l => { try { return multisig.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "TransactionSubmitted");
      if (!ev2) throw new Error("No TransactionSubmitted for associateHTLC");
      assocTxID = ev2.args.txID;
    } catch (err) {
      console.error(`❌ Submit associateHTLC failed for trade #${idx}:`, err?.error?.error?.message || err?.message || err);
      continue;
    }

    for (let j = 0; j < Number(threshold); j++) {
      try {
        await multisig.connect(localOwners[j]).confirmTransaction(assocTxID);
      } catch {}
    }

    try {
      const execAssoc = await multisig.connect(localOwners[0]).executeTransaction(assocTxID);
      await execAssoc.wait();
      associated++;
    } catch (err) {
      console.error(`❌ Execute associateHTLC failed for trade #${idx}:`, err?.error?.error?.message || err?.message || err);
    }

    // 6) export data for BTC side
    htlcMetadata.push({
      lockId: lockId.toString(),
      locktime: Number(t.locktime),
      // keep the baseSecret; BTC side uses per-trade salted SHA-256 below
      secretBase: baseSecret,
      secretHashKeccak: perTradeKeccak,
      secretHashSha256: perTradeSha256,
      ethAmount: Number(hre.ethers.formatEther(t.ethAmount)),
      btcAmount: Number((Number(t.btcAmount) / 1e8).toFixed(8)),
      recipient: t.recipient,
    });
  }

  console.log("\nSummary:");
  console.log(`${created} HTLC(s) locked on-chain for BuyIntent ${buyIntentId}`);
  console.log(`${associated} HTLC association(s) recorded`);
  if (created > 0) {
    console.log("Shared Base Secret:", baseSecret);
    console.log("Base Keccak (ETH):", baseKeccak);
    console.log("Per-trade salts: keccak(base || idx) / sha256(base + '#' + idx)");
  }

  // --- persist metadata (both locations) ---
  const outputs = [
    path.resolve(__dirname, "../../../bitcoin-chain/data-script/exchange-data.json"),
    path.resolve(__dirname, "../../data/exchange-data.json"),
  ];
  for (const outPath of outputs) {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ success: true, buyIntentId, htlcs: htlcMetadata }, null, 2));
    console.log(`HTLC metadata saved to: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
