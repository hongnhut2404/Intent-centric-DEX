const hre = require("hardhat");
const readline = require("readline-sync");
const fs = require("fs");
const path = require("path");

async function main() {
  const buyIntentId = 0;

  const secret = readline.question("Enter the shared secret preimage: ");
  const secretHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret));

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
  const localOwners = ownerAddresses
    .map((addr) => allSigners.find((s) => s.address === addr))
    .filter(Boolean);

  if (localOwners.length < 2) {
    throw new Error("Not enough local multisig owners to execute withdrawals.");
  }

  const [submitter, confirmer] = localOwners;

  const filter = intentMatching.filters.HTLCAssociated(buyIntentId);
  const events = await intentMatching.queryFilter(filter);

  if (events.length === 0) {
    console.log("No HTLCs associated with this BuyIntent.");
    return;
  }

  let successCount = 0;

  for (const event of events) {
    const { lockId, recipient } = event.args;

    const balanceBefore = await hre.ethers.provider.getBalance(recipient);
    console.log(`\nLockID ${lockId}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Balance before: ${hre.ethers.formatEther(balanceBefore)} ETH`);

    const calldata = htlc.interface.encodeFunctionData("withdraw", [lockId, secret]);

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

      const balanceAfter = await hre.ethers.provider.getBalance(recipient);
      const delta = balanceAfter - balanceBefore;

      console.log("Withdrawal successful.");
      console.log(`Balance after: ${hre.ethers.formatEther(balanceAfter)} ETH`);
      console.log(`Received: +${hre.ethers.formatEther(delta)} ETH`);
      successCount++;
    } catch (err) {
      console.error("Withdrawal failed:", err.reason || err.message);
    }
  }

  if (successCount === 0) {
    console.log("No HTLCs withdrawn.");
  } else {
    console.log(`\nSuccessfully withdrawn ${successCount} HTLC(s) for BuyIntent ${buyIntentId}.`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
