// npx hardhat run localhost-script/matching-intent/createSellIntent.direct.js --network localhost
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const signers = await hre.ethers.getSigners();

  // Pick MM: default index 1, override with MM_INDEX
  const mmIndex = process.env.MM_INDEX ? parseInt(process.env.MM_INDEX, 10) : 1;
  if (Number.isNaN(mmIndex) || mmIndex < 0 || mmIndex >= signers.length) {
    throw new Error(`Invalid MM_INDEX=${process.env.MM_INDEX}. There are ${signers.length} signers.`);
  }
  const marketMaker = signers[mmIndex];
  console.log(`Using Market Maker signer [${mmIndex}]: ${marketMaker.address}`);

  // Load address
  const { address: intentMatchingAddress } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );
  console.log("IntentMatching at:", intentMatchingAddress);

  // Get contract
  const contract = await hre.ethers.getContractAt("IntentMatching", intentMatchingAddress);

  // Ensure market maker is set on-chain to this signer
  let currentMM;
  try { currentMM = await contract.marketMaker(); } catch { currentMM = null; }
  if (currentMM == null) {
    console.log("ABI doesn’t expose marketMaker(); ensure ABI is up to date.");
  } else if (currentMM.toLowerCase() !== marketMaker.address.toLowerCase()) {
    console.log(`Updating marketMaker: ${currentMM} → ${marketMaker.address}`);
    const owner = signers[0];
    await (await contract.connect(owner).setMarketMaker(marketMaker.address)).wait();
    const verify = await contract.marketMaker();
    console.log("marketMaker now:", verify);
  } else {
    console.log("marketMaker already set to:", currentMM);
  }

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // Sell intents: (sell ETH, min BTC)
  const sellIntents = [
    { sellETH: "100.0", minBTC: "4.0" },
    { sellETH: "50.0",  minBTC: "2.0" },
    { sellETH: "10.0",  minBTC: "0.35" },
  ];

  const mmContract = contract.connect(marketMaker);

  for (let i = 0; i < sellIntents.length; i++) {
    const { sellETH, minBTC } = sellIntents[i];

    const sellAmountETH = hre.ethers.parseUnits(sellETH, 18);
    const minBuyAmountBTC = BigInt(minBTC * 1e8);
    const offchainId = hre.ethers.encodeBytes32String(`sell-${i}-${Date.now()}`);

    console.log(`Submitting SellIntent #${i}: sell ${sellETH} ETH for min ${minBTC} BTC`);
    const tx = await mmContract.createSellIntent(
      sellAmountETH,
      minBuyAmountBTC,
      deadline,
      offchainId
    );
    const receipt = await tx.wait();

    let printed = false;
    for (const log of receipt.logs || []) {
      try {
        const parsed = mmContract.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed.name === "SellIntentCreated") {
          const { intentId, seller, sellAmount, minBuyAmount, deadline: dl, offchainId: ofc } = parsed.args;
          console.log(`SellIntentCreated:
  - id:          ${intentId}
  - seller:      ${seller}
  - sellAmount:  ${hre.ethers.formatEther(sellAmount)} ETH
  - minBuyAmount:${hre.ethers.formatUnits(minBuyAmount, 8)} BTC
  - deadline:    ${dl}
  - offchainId:  ${ofc}`);
          printed = true;
        }
      } catch {}
    }
    if (!printed) console.log(`SellIntent #${i} tx hash: ${receipt.hash}`);
  }

  console.log("All SellIntents created directly by Market Maker EOA.");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
