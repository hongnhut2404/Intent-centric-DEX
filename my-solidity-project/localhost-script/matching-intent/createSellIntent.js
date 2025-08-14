const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const signers = await hre.ethers.getSigners();

  // Load IntentMatching contract address
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = await IntentMatching.attach(intentMatchingAddress);

  // Get multisig wallet address from contract storage
  const multisigAddress = await contract.multisigWallet();
  console.log("Multisig wallet (on-chain):", multisigAddress);

  const MultisigWallet = await hre.ethers.getContractFactory("MultisigWallet");
  const multisig = await MultisigWallet.attach(multisigAddress);

  // Get on-chain owners of the multisig
  const owners = await multisig.getOwners();
  console.log("Multisig owners:", owners);

  // Map on-chain owners to local Hardhat signers
  const signerMap = {};
  for (const signer of signers) {
    signerMap[signer.address.toLowerCase()] = signer;
  }

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const offchainId = hre.ethers.encodeBytes32String("sell-eth");

  // Define sell intents
  const sellIntents = [
    { amountBTC: 1.0, minBuyETH: "0.75" },
    { amountBTC: 3.5, minBuyETH: "1.6" },
    { amountBTC: 6.0, minBuyETH: "3.0" },
    { amountBTC: 1.0, minBuyETH: "0.5" },
    { amountBTC: 2.5, minBuyETH: "1.75" },
  ];

  for (let i = 0; i < sellIntents.length; i++) {
    const { amountBTC, minBuyETH } = sellIntents[i];

    const sellAmount = BigInt(amountBTC * 1e8); // BTC in satoshis
    const minBuyAmount = hre.ethers.parseUnits(minBuyETH, 18); // ETH in wei

    const data = contract.interface.encodeFunctionData("createSellIntent", [
      sellAmount,
      minBuyAmount,
      deadline,
      offchainId
    ]);

    const ownerSigner = signerMap[owners[0].toLowerCase()];
    if (!ownerSigner) {
      console.error(`No signer found for owner ${owners[0]}`);
      return;
    }

    const tx = await multisig
      .connect(ownerSigner)
      .submitTransaction(intentMatchingAddress, 0, data);

    const receipt = await tx.wait();

    const parsed = receipt.logs
      .map((log) => {
        try {
          return multisig.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "TransactionSubmitted");

    if (parsed) {
      console.log(`SellIntent ${i} submitted via multisig. TxID: ${parsed.args.txID}`);
    } else {
      console.log(`SellIntent ${i} submitted, but event not parsed.`);
    }
  }

  console.log("All SellIntents submitted via multisig. Use confirm script to proceed.");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
