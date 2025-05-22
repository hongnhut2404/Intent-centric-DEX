const { ethers } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    const tokenAAddress = "0x9bc0897FBA66ca6A520c851568eedC8B54B3d27B"; // From deployment
    const tokenBAddress = "0x6B564dA8EfC9748988BD8E2786D22c25cEfc8C8E";
    const buyerAddress = "0x90eF2f6DcEAb9251AF51c02F46Dfdf77f925D781"; // MetaMask Account 2
    const sellerAddress = "0xCE67aBC0e8a016992b200D3Bd4EBdD6B793212C1"; // MetaMask Account 3 or deployer

    const Token = await ethers.getContractFactory("ERC20Token");
    const tokenA = Token.attach(tokenAAddress);
    const tokenB = Token.attach(tokenBAddress);

    const amount = ethers.parseEther("500");
    await tokenA.transfer(buyerAddress, amount);
    await tokenB.transfer(sellerAddress, amount);
    console.log(`Sent ${ethers.formatEther(amount)} TTA to Buyer: ${buyerAddress}`);
    console.log(`Sent ${ethers.formatEther(amount)} TTB to Seller: ${sellerAddress}`);
}

main().catch(error => console.error(error));