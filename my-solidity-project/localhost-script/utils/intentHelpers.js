const { ethers } = require("hardhat");

function toSatoshi(btcFloat) {
    return Math.round(btcFloat * 1e8); // Convert BTC to satoshi as integer
}

async function createBuyIntent(intentMatching, user, btcAmount, minETHWanted, locktime, offchainIdStr) {
    const sellAmountBTC = toSatoshi(btcAmount);
    const offchainId = ethers.keccak256(ethers.toUtf8Bytes(offchainIdStr));
    const tx = await intentMatching.connect(user).createBuyIntent(
        sellAmountBTC,
        ethers.parseEther(minETHWanted.toString()),
        locktime,
        offchainId
    );
    await tx.wait();
    console.log(`BuyIntent created by ${user.address}`);
}

async function createSellIntent(intentMatching, user, ethAmount, minBTC, deadline, offchainIdStr) {
    const offchainId = ethers.keccak256(ethers.toUtf8Bytes(offchainIdStr));
    const minBTCExpected = toSatoshi(minBTC);
    const tx = await intentMatching.connect(user).createSellIntent(
        ethers.parseEther(ethAmount.toString()),
        minBTCExpected,
        deadline,
        offchainId
    );
    await tx.wait();
    console.log(`SellIntent created by ${user.address}: ${ethAmount} ETH for ${minBTCExpected / 1e8} BTC`);
}

async function printAllIntents(contract) {
  const buyCount = await contract.intentCountBuy();
  const sellCount = await contract.intentCountSell();

  console.log("---- Buy Intents ----");
  for (let i = 0n; i < buyCount; i++) {
    const intent = await contract.buyIntents(i);
    console.log(`ID ${i}: {`);
    console.log(`  buyer: '${intent.buyer}',`);
    console.log(`  sellAmountBTC: ${Number(intent.sellAmount) / 1e8},`);
    console.log(`  buyAmountETH: ${ethers.formatEther(intent.minBuyAmount)},`);
    console.log(`  status: ${intent.status},`);
    console.log(`  locktime: ${intent.locktime}`);
    console.log(`}`);
  }

  console.log("\n---- Sell Intents ----");
  for (let i = 0n; i < sellCount; i++) {
    const intent = await contract.sellIntents(i);
    console.log(`ID ${i}: {`);
    console.log(`  seller: '${intent.seller}',`);
    console.log(`  buyAmountBTC: ${Number(intent.minBuyAmount) / 1e8},`);
    console.log(`  sellAmountETH: ${ethers.formatEther(intent.sellAmount)},`);
    console.log(`  status: ${intent.status},`);
    console.log(`  deadline: ${intent.deadline}`);
    console.log(`}`);
  }
}


module.exports = {
    toSatoshi,
    createBuyIntent,
    createSellIntent,
    printAllIntents
};