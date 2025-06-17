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

async function printAllIntents(intentMatching) {
  const buyCount = await intentMatching.intentCountBuy();
  const sellCount = await intentMatching.intentCountSell();

  console.log("---- Buy Intents ----");
  for (let i = 0; i < buyCount; i++) {
    const intent = await intentMatching.getBuyIntent(i);
    console.log(`ID ${i}:`, {
      buyer: intent.buyer,
      sellAmountBTC: Number(intent.sellAmount) / 1e8,
      minBuyAmountETH: Number(intent.minBuyAmount) / 1e18,
      status: intent.status,
      locktime: Number(intent.locktime)
    });
  }

  console.log("\n---- Sell Intents ----");
  for (let i = 0; i < sellCount; i++) {
    const intent = await intentMatching.getSellIntent(i);
    console.log(`ID ${i}:`, {
      seller: intent.seller,
      sellAmountETH: Number(intent.sellAmount) / 1e18,
      minBuyAmountBTC: Number(intent.minBuyAmount) / 1e8,
      status: intent.status,
      deadline: Number(intent.deadline)
    });
  }
}


module.exports = {
    toSatoshi,
    createBuyIntent,
    createSellIntent,
    printAllIntents
};