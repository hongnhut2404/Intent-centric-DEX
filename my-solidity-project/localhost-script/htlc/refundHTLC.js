const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const allSigners = await hre.ethers.getSigners();

  // Load contract addresses
  const intentJsonPath = path.resolve(__dirname, "../../data/intent-matching-address.json");
  const { address: intentMatchingAddress } = JSON.parse(fs.readFileSync(intentJsonPath));
  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();
  const htlc = await HTLC.attach(htlcAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  const multisig = await MultisigWallet.attach(multisigAddress);

  const ownerAddresses = await multisig.getOwners();
  const localOwners = ownerAddresses.map(addr => allSigners.find(s => s.address === addr)).filter(Boolean);

  if (localOwners.length < 2) {
    throw new Error("Not enough local multisig owners found.");
  }

  const [submitter, confirmer] = localOwners;

  const lockedEvents = await htlc.queryFilter(htlc.filters.Locked());

  if (lockedEvents.length === 0) {
    console.log("No Locked events found.");
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  let refundedCount = 0;

  for (const event of lockedEvents) {
    const { id: lockId, sender } = event.args;
    const lock = await htlc.getLock(lockId);

    if (lock.withdrawn || lock.refunded) {
      console.log(`Skipping lockId ${lockId}: already withdrawn or refunded.`);
      continue;
    }

    if (now < lock.timelock) {
      console.log(`Skipping lockId ${lockId}: not yet expired (timelock = ${lock.timelock})`);
      continue;
    }

    const balanceBefore = await hre.ethers.provider.getBalance(sender);
    console.log(`Refunding lockId ${lockId} for sender ${sender}`);
    console.log("Amount:", hre.ethers.formatEther(lock.amount), "ETH");
    console.log("Balance before:", hre.ethers.formatEther(balanceBefore), "ETH");

    const calldata = htlc.interface.encodeFunctionData("refund", [lockId]);

    try {
      const submitTx = await multisig.connect(submitter).submitTransaction(htlcAddress, 0, calldata);
      const receipt = await submitTx.wait();

      const txID = receipt.logs
        .map((log) => {
          try {
            return multisig.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log?.name === "TransactionSubmitted")?.args.txID;

      if (txID === undefined) {
        console.error("Failed to extract txID");
        continue;
      }

      await multisig.connect(confirmer).confirmTransaction(txID);
      const execTx = await multisig.connect(submitter).executeTransaction(txID);
      await execTx.wait();

      const balanceAfter = await hre.ethers.provider.getBalance(sender);
      console.log("Refund successful.");
      console.log("Balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
      console.log("Refunded:", hre.ethers.formatEther(balanceAfter - balanceBefore), "ETH");

      refundedCount++;
    } catch (err) {
      console.error(`Refund failed for lockId ${lockId}:`, err.reason || err.message);
    }
  }

  if (refundedCount === 0) {
    console.log("No refundable HTLCs found.");
  } else {
    console.log(`Refunded ${refundedCount} HTLC(s).`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
