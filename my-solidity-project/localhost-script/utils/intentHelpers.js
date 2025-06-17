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


module.exports = {
    toSatoshi,
    createBuyIntent,
    createSellIntent
};