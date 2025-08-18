// scripts/htlc/createHTLC.js
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ---------- helpers ----------
function getBuyIdOrDefault() {
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

function generateRandomSecret(len = 16) {
  // URL-safe base64 to keep it printable, you can switch to hex if you prefer
  return crypto.randomBytes(len).toString("base64url");
}

function bn(x) {
  return typeof x === "bigint" ? x : BigInt(x.toString());
}

function readJsonSafe(p) {
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch {}
  return null;
}

function ensureDir(p) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function writeJson(p, obj) {
  ensureDir(p);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  console.log(`HTLC metadata saved to: ${p}`);
}

// Try to load a previously used baseSecret for this buyId
function loadOrCreateBaseSecret(buyId, existing) {
  // existing format: { success, buyIntentId, baseSecret, htlcs: [...] }  (new format)
  if (existing && existing.buyIntentId === buyId && typeof existing.baseSecret === "string" && existing.baseSecret.length > 0) {
    return existing.baseSecret;
  }
  // Backward-compat with your old format (an array of htlcs each with secretBase),
  // if you ever wrote it like that—try to recover from first entry:
  if (existing && Array.isArray(existing.htlcs) && existing.htlcs.length > 0) {
    const s = existing.htlcs[0].secretBase;
    if (typeof s === "string" && s.length > 0) return s;
  }
  // else generate a new one
  return generateRandomSecret(16);
}

// ---------- main ----------
async function main() {
  const buyIntentId = getBuyIdOrDefault();
  console.log(`Using BUY_ID = ${buyIntentId}`);

  // File paths (both ecosystems)
  const outPaths = [
    path.resolve(__dirname, "../../../bitcoin-chain/data-script/exchange-data.json"),
    path.resolve(__dirname, "../../data/exchange-data.json"),
  ];

  // If we already have a file, try to reuse secret for the same buyId
  const existing = readJsonSafe(outPaths[1]) || readJsonSafe(outPaths[0]);
  const baseSecret = loadOrCreateBaseSecret(buyIntentId, existing);
  const baseKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(baseSecret));
  const baseSha256 = crypto.createHash("sha256").update(baseSecret).digest("hex");

  console.log("Shared Base Secret:", baseSecret);
  console.log("Base Keccak (ETH):", baseKeccak);
  console.log("Base SHA256  (BTC):", baseSha256);
  console.log("(Same secret/hash will be used for every HTLC under this BUY_ID)");

  // --- wire up contracts ---
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
    // Still persist a stub with the baseSecret so it can be reused later
    const stub = { success: true, buyIntentId, baseSecret, htlcs: [] };
    outPaths.forEach(p => writeJson(p, stub));
    return;
  }

  // filter zero-ETH and sum
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
    const stub = { success: true, buyIntentId, baseSecret, htlcs: [] };
    outPaths.forEach(p => writeJson(p, stub));
    return;
  }

  // --- check multisig balance ---
  const msigBal = await hre.ethers.provider.getBalance(multisigAddress);
  if (msigBal < totalEthNeeded) {
    console.warn(`⚠️ Multisig balance ${hre.ethers.formatEther(msigBal)} ETH < needed ${hre.ethers.formatEther(totalEthNeeded)} ETH`);
    console.warn("Proceeding best-effort (some locks may fail). Consider funding the multisig first.");
  }

  const htlcMetadata = [];
  let created = 0;
  let associated = 0;

  console.log(`\nWill attempt HTLCs for ${usable.length} trade(s) with ONE shared hash.`);

  for (const { idx, t } of usable) {
    // 👇 Use the SAME hash for every HTLC in this BUY_ID
    const secretHashKeccak = baseKeccak;

    // 1) submit newLock (value = ethAmount)
    const calldata = htlc.interface.encodeFunctionData("newLock", [
      t.recipient,
      secretHashKeccak,
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
      try { await multisig.connect(localOwners[j]).confirmTransaction(txID); } catch {}
    }

    // 3) execute
    let execReceipt;
    try {
      const execTx = await multisig.connect(localOwners[0]).executeTransaction(txID);
      execReceipt = await execTx.wait();
      created++;
    } catch (err) {
      console.error(`❌ Execute newLock failed for trade #${idx}, txID ${txID}:`, err?.error?.error?.message || err?.message || err);
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
      secretHashKeccak, // same hash we locked with
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
      try { await multisig.connect(localOwners[j]).confirmTransaction(assocTxID); } catch {}
    }

    try {
      const execAssoc = await multisig.connect(localOwners[0]).executeTransaction(assocTxID);
      await execAssoc.wait();
      associated++;
    } catch (err) {
      console.error(`❌ Execute associateHTLC failed for trade #${idx}:`, err?.error?.error?.message || err?.message || err);
    }

    // 6) export data for BTC + future ETH withdraw UI
    htlcMetadata.push({
      lockId: lockId.toString(),
      locktime: Number(t.locktime),
      // Keep record of the shared secret & hashes for clarity / BTC side linking
      secretHashKeccak: secretHashKeccak,
      secretHashSha256: baseSha256,
      ethAmount: Number(hre.ethers.formatEther(t.ethAmount)),
      btcAmount: Number((Number(t.btcAmount) / 1e8).toFixed(8)),
      recipient: t.recipient,
    });
  }

  console.log("\nSummary:");
  console.log(`${created} HTLC(s) locked on-chain for BuyIntent ${buyIntentId}`);
  console.log(`${associated} HTLC association(s) recorded`);
  if (created > 0) {
    console.log("One shared secret used across all HTLCs for this BUY_ID.");
  }

  // --- persist in the new single-secret format ---
  const outObj = {
    success: true,
    buyIntentId,
    baseSecret,          // 👈 persist the shared secret
    baseKeccak,
    baseSha256,
    htlcs: htlcMetadata, // list of HTLCs created for this buyId
  };

  outPaths.forEach(p => writeJson(p, outObj));
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
