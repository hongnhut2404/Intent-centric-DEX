const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function readInput(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(data);
    const requiredFields = ["htlcAddress", "lockId", "secret", "recipient"];

    for (const field of requiredFields) {
      if (
        !parsed.hasOwnProperty(field) ||
        parsed[field] === null ||
        parsed[field] === undefined
      ) {
        throw new Error(`Missing or null field in input JSON: ${field}`);
      }
    }
    return parsed;

  } catch (error) {
    console.error("Error reading or parsing input file:", error.message);
    process.exit(1);
  }
}

async function main() {
  const input = readInput("../data/htlc-data.json");

  // Read input data 
  const htlcAddress = input.htlcAddress; 
  const lockId = input.lockId; 
  const secret = input.secret; 
  const recipient = input.recipient; 
  const signer = await hre.ethers.getSigner(recipient);

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress);

  const balanceBefore = await hre.ethers.provider.getBalance(recipient);
  console.log("Balance before:", hre.ethers.formatEther(balanceBefore), "ETH");

  console.log(`Withdrawing from lock ID ${lockId}...`);
  
  //Waits until the transaction is mined (confirmed in a block).
  const tx = await htlc.connect(signer).withdraw(lockId, secret);
  await tx.wait();

  console.log("Withdrawal successful");

  const balanceAfter = await hre.ethers.provider.getBalance(recipient);
  console.log("Balance after:", hre.ethers.formatEther(balanceAfter), "ETH");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
