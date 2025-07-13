const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");

async function main() {
  const [_, owner1, owner2] = await hre.ethers.getSigners(); // Use owner1 and owner2

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

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const offchainId = ethers.encodeBytes32String("sell-eth");

  const sellIntents = [
    { amountBTC: 1.0, minBuyETH: "0.75" },
    { amountBTC: 3.5, minBuyETH: "2.0" },
    { amountBTC: 6.0, minBuyETH: "4.2" },
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

    const tx = await multisig
      .connect(owner1) // Use owner1 who is actually in the multisig
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
