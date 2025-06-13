const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function readInput(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(data);
    const requiredFields = ["htlcAddress", "timelock", "recipientAddress", "senderAddress", "amount"];

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

function writeOutput(output, filePath) {
  const fullPath = path.join(__dirname, filePath);
  try {
    fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
    console.log(`Saved to ${filePath}`);
  } catch (error) {
    console.error(`Failed to write to ${filePath}:`, error.message);
    process.exit(1);
  }
}


async function main() {
  const input = readInput("../data/htlc-initiate.json");

  //Read input
  const htlcAddress = input.htlcAddress;
  const timelock = Math.floor(Date.now() / 1000) + input.timelock;
  const recipient = input.recipientAddress; // Bob
  const sender = input.senderAddress; //Alice
  const amount = input.amount;

  const alice = await hre.ethers.getSigner(sender);

  const HTLC = await hre.ethers.getContractFactory("HTLC");
  const htlc = await HTLC.attach(htlcAddress).connect(alice);

  // Generate unique secret
  const secret = "mysecret" + Date.now();
  const hashKeccak = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(secret)); // Ethereum
  const hashSha256 = crypto.createHash("sha256").update(secret).digest("hex"); // Bitcoin

  console.log("Creating lock with secret:", secret);
  let tx;
  try {
    tx = await htlc.connect(alice).newLock(recipient, hashKeccak, timelock, {
      value: hre.ethers.parseEther(amount),
    });
  } catch (error) {
    console.error("newLock failed:", error.reason || error.message);
    throw hre.ethers.parseEther(amount);
  }

  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error("Transaction failed, check contract state or gas");
  }

  const event = receipt.logs
    .map((log) => {
      try {
        return htlc.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event && event.name === "Locked");

  if (!event) {
    console.log("Raw logs:", receipt.logs);
    throw new Error("Locked event not found");
  }


  const lockId = event.args.id;
  const lock = await htlc.getLock(lockId);

  console.log("Lock created with ID:", lockId);
  console.log("Secret:", secret);
  console.log("Ethereum Hashlock (keccak256):", hashKeccak);
  console.log("Bitcoin Hashlock (sha256):", hashSha256);
  console.log("Timelock (epoch):", timelock);
  console.log("Sender address:", lock.sender);

  // Save to htlc-data.json for reuse
  const output = {
    htlcAddress,
    secret,
    hashKeccak,
    hashSha256,
    timelock,
    lockId,
    sender: lock.sender,
    recipient,
    amount,
  };

  const exchangeData = {
    hashSha256,
    timelock,
    lockId,
  }

  writeOutput(output, "../data/htlc-data.json");
  writeOutput(exchangeData, "../data/exchange-data.json");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
