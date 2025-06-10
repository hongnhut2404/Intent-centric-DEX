const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  console.log("HTLC deployed to:", htlc.target);

  const output = { htlcAddress: htlc.target, timelock: null, recipientAddress: null, senderAddress:null };

  fs.writeFileSync(
    path.join(__dirname, "../data/htlc-initiate.json"),
    JSON.stringify(output, null, 2),
  )
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});