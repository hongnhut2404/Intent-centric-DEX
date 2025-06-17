const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  console.log("HTLC deployed to:", htlc.target);

  const filePath = path.join(__dirname, "../../data/htlc-initiate.json");

  let data = {};
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath);
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn("Invalid existing JSON. Starting fresh.");
    }
  }

  data.htlcAddress = htlc.target;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log("Updated htlc-initiate.json with htlcAddress");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
