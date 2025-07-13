const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
  const signers = await hre.ethers.getSigners();

  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(intentMatchingAddress);

  // Get multisig from contract storage
  const multisigAddress = await contract.multisigWallet();
  console.log("Multisig wallet (on-chain):", multisigAddress);

  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");
  const multisig = MultisigWallet.attach(multisigAddress);

  // Fetch on-chain owner addresses
  const owners = await multisig.getOwners();
  console.log("Multisig owners:", owners);

  // Match with signers to get their private keys
  const signerMap = {};
  for (const signer of signers) {
    signerMap[signer.address.toLowerCase()] = signer;
  }

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const offchainId = ethers.encodeBytes32String("sell-eth");

  const sellIntents = [
    { amountBTC: 1.0, minBuyETH: "0.75" },
    { amountBTC: 3.5, minBuyETH: "1.6" },
    { amountBTC: 6.0, minBuyETH: "3.0" },
  ];

  for (let i = 0; i < sellIntents.length; i++) {
    const { amountBTC, minBuyETH } = sellIntents[i];
    const sellAmount = BigInt(amountBTC * 1e8); // BTC in sat
    const minBuyAmount = hre.ethers.parseUnits(minBuyETH, 18); // ETH in wei

    const data = contract.interface.encodeFunctionData("createSellIntent", [
      sellAmount,
      minBuyAmount,
      deadline,
      offchainId,
    ]);

    const ownerSigner = signerMap[owners[0].toLowerCase()];
    if (!ownerSigner) {
      console.error(`No signer available for owner ${owners[0]}`);
      return;
    }

    const tx = await multisig
      .connect(ownerSigner)
      .submitTransaction(intentMatchingAddress, 0, data);
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log) => {
        try {
          return multisig.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "TransactionSubmitted");

    if (event) {
      console.log(`SellIntent ${i} submitted via multisig. TxID: ${event.args.txID}`);
    } else {
      console.log(`SellIntent ${i} submitted (no event parsed)`);
    }
  }

  console.log("All SellIntents submitted via multisig. Now you can confirm them.");
}

main().catch(console.error);
