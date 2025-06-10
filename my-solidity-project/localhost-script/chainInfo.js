const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock("latest");
  const gasPrice = await provider.getFeeData();
  const network = await provider.getNetwork();

  console.log("Block number:", blockNumber);
  console.log("Chain ID:", network.chainId);
  console.log("Gas price:", hre.ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
  console.log("Timestamp:", block.timestamp);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
