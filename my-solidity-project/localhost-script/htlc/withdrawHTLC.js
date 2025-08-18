// scripts/htlc/withdrawHTLC.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = parseInt(process.env.BUY_ID || "0", 10);
  const secret = (process.env.SECRET || "").trim();

  if (!secret) {
    throw new Error(
      "SECRET env is required. Example:\n" +
      "  SECRET=mysecret BUY_ID=1 npx hardhat run scripts/htlc/withdrawHTLC.js --network localhost"
    );
  }

  const allSigners = await hre.ethers.getSigners();

  // Load deployed addresses
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../data/intent-matching-address.json"), "utf8")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");

  const intentMatching = await IntentMatching.attach(intentMatchingAddress);
  const htlcAddress = await intentMatching.htlcAddress();
  const htlc = await HTLC.attach(htlcAddress);
  const multisigAddress = await intentMatching.multisigWallet();
  const multisig = await MultisigWallet.attach(multisigAddress);

  // Build the set of available local multisig owners
  const owners = await multisig.getOwners();
  const localSigners = owners
    .map((addr) =>
      allSigners.find((s) => s.address.toLowerCase() === addr.toLowerCase())
    )
    .filter(Boolean);

  if (localSigners.length < owners.length) {
    console.warn("Warning: Some multisig owners are not available locally.");
  }

  // Find HTLCs associated to this BuyIntent
  const filter = intentMatching.filters.HTLCAssociated(buyIntentId);
  const events = await intentMatching.queryFilter(filter);

  if (events.length === 0) {
    console.log("No HTLCs associated with this BuyIntent.");
    return;
  }

  let successCount = 0;

  for (const event of events) {
    const { lockId, recipient } = event.args;
    console.log(`\nWithdrawing HTLC: lockId=${lockId}, recipient=${recipient}`);

    // Prepare call data for HTLC.withdraw(lockId, bytes secret)
    const calldata = htlc.interface.encodeFunctionData("withdraw", [
      lockId,
      hre.ethers.toUtf8Bytes(secret),
    ]);

    try {
      // 1) submit
      const submitTx = await multisig
        .connect(localSigners[0])
        .submitTransaction(htlcAddress, 0, calldata);
      await submitTx.wait();
      const txID = (await multisig.txCounter()) - 1n;

      // 2) confirm by all local owners we have
      for (const signer of localSigners) {
        try {
          const tx = await multisig.connect(signer).confirmTransaction(txID);
          await tx.wait();
          console.log(`Tx ${txID} confirmed by ${signer.address}`);
        } catch (err) {
          if (!String(err.message).includes("Already confirmed")) {
            console.warn(`Confirm by ${signer.address} failed: ${err.message}`);
          }
        }
      }

      // 3) execute
      const balanceBefore = await hre.ethers.provider.getBalance(recipient);
      const execTx = await multisig.connect(localSigners[0]).executeTransaction(txID);
      await execTx.wait();
      const balanceAfter = await hre.ethers.provider.getBalance(recipient);
      const delta = balanceAfter - balanceBefore;

      console.log("Withdraw successful.");
      console.log(`Balance before: ${hre.ethers.formatEther(balanceBefore)} ETH`);
      console.log(`Balance after : ${hre.ethers.formatEther(balanceAfter)} ETH`);
      console.log(`Received      : +${hre.ethers.formatEther(delta)} ETH`);
      successCount++;
    } catch (err) {
      console.error("Withdraw failed:", err.reason || err.message);
    }
  }

  console.log(
    `\nSummary: Successfully withdrew ${successCount} HTLC(s) for BuyIntent ${buyIntentId}`
  );
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exitCode = 1;
});
