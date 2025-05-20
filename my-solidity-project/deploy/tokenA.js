const {ethers} = require('hardhat')

const main = async() => {
    const [owner] = await ethers.getSigners();

    console.log(owner.address);

    const tokenA = await ethers.getContractFactory("ERC20Token");
    const initialSupply = 50_000n * 10n ** 18n;
    const tokenAInstance = await tokenA.deploy("TokenA","TTA", initialSupply);
    await tokenAInstance.waitForDeployment();
    
    const tokenAAddress = await tokenAInstance.getAddress();
    console.log("Address of token A: ", tokenAAddress);
}

main().catch((e) => {
    console.log(e);
    process.exit(1);
})