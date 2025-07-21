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
  const multisigAddress = await intentMatching.multisigWallet();
  const htlc = await HTLC.attach(htlcAddress);
  const multisig = await MultisigWallet.attach(multisigAddress);

  const ownerAddresses = await multisig.getOwners();
  const localOwners = ownerAddresses
    .map(addr => allSigners.find(s => s.address.toLowerCase() === addr.toLowerCase()))
    .filter(Boolean);

  const threshold = await multisig.required();
  if (localOwners.length < threshold) {
    throw new Error(`Not enough local multisig owners (need ${threshold})`);
  }

  const now = Math.floor(Date.now() / 1000);
  console.log(`Current timestamp: ${now} - ${new Date(now * 1000).toLocaleString()}`);

  const lockedEvents = await htlc.queryFilter(htlc.filters.Locked());
  if (lockedEvents.length === 0) {
    console.log("No Locked events found.");
    return;
  }

  let refundedCount = 0;

  for (const event of lockedEvents) {
    const { id: lockId } = event.args;

    const isStillLocked = await htlc.isLocked(lockId);
    if (!isStillLocked) {
      console.log(`Skipping lockId ${lockId}: already withdrawn or refunded.`);
      continue;
    }

    const lock = await htlc.lockData(lockId);
    const timelock = Number(lock.timelock);
    const formattedTime = new Date(timelock * 1000).toLocaleString();

    console.log(`\nLockID: ${lockId}`);
    console.log(`  Timelock: ${timelock} (${formattedTime})`);

    if (now < timelock) {
      console.log(`  Skipping: not yet expired.`);
      continue;
    }

    const balanceBefore = await hre.ethers.provider.getBalance(multisigAddress);
    console.log(`  Refunding ${hre.ethers.formatEther(lock.amount)} ETH to Multisig (${multisigAddress})`);
    console.log(`  Balance before: ${hre.ethers.formatEther(balanceBefore)} ETH`);

    const calldata = htlc.interface.encodeFunctionData("refund", [lockId]);

    try {
      const submitTx = await multisig.connect(localOwners[0]).submitTransaction(htlcAddress, 0, calldata);
      await submitTx.wait();

      const txID = (await multisig.txCounter()) - 1n;

      for (let j = 0; j < threshold; j++) {
        try {
          const confirmTx = await multisig.connect(localOwners[j]).confirmTransaction(txID);
          await confirmTx.wait();
          console.log(`  Tx ${txID} confirmed by ${localOwners[j].address}`);
        } catch (err) {
          if (!err.message.includes("Already confirmed")) {
            console.warn(`  Confirm failed by ${localOwners[j].address}: ${err.message}`);
          }
        }
      }

      const execTx = await multisig.connect(localOwners[0]).executeTransaction(txID);
      await execTx.wait();

      const balanceAfter = await hre.ethers.provider.getBalance(multisigAddress);
      console.log(`  Refund successful.`);
      console.log(`  Balance after: ${hre.ethers.formatEther(balanceAfter)} ETH`);
      console.log(`  Refunded: ${hre.ethers.formatEther(balanceAfter - balanceBefore)} ETH`);

      refundedCount++;
    } catch (err) {
      console.error(`  Refund failed for lockId ${lockId}:`, err.reason || err.message);
    }
  }

  console.log(`\nSummary: ${refundedCount} HTLC(s) refunded.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
