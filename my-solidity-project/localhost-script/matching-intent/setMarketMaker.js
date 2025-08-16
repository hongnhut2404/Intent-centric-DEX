// scripts/setMarketMaker.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [owner, mmSigner] = await hre.ethers.getSigners(); // mmSigner is account #1

  const { address } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(address);

  const mm = mmSigner.address; // <-- define it!
  console.log("Owner (onlyOwner):", owner.address);
  console.log("Setting marketMaker to:", mm);

  const tx = await contract.connect(owner).setMarketMaker(mm);
  await tx.wait();

  // optional read-back
  const onChain = await contract.marketMaker();
  console.log("marketMaker on-chain:", onChain);
}

main().catch((e) => { console.error(e); process.exit(1); });
