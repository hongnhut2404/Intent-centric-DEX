// scripts/setMM.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [owner] = await hre.ethers.getSigners();

  const { address } = JSON.parse(
    fs.readFileSync("data/intent-matching-address.json", "utf8")
  );

  const IntentMatching = await hre.ethers.getContractFactory("IntentMatching");
  const contract = IntentMatching.attach(address);

  
  const tx = await contract.connect(owner).setMarketMaker(mm);
  await tx.wait();
  console.log("marketMaker set to:", mm);
}

main().catch((e) => { console.error(e); process.exit(1); });
