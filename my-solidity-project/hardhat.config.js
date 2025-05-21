require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20", // Match your contract's pragma
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      },
      viaIR: true
    }
  },
  networks: {
    arbitrum: {
      url: "https://arbitrum-sepolia.infura.io/v3/2dc23c5500734c9c9fa5b362bfb0bc19",
      accounts: ["627116e89e69c43df10c69397e13467b3ed7324e4ef49640b40bfc69af50aa11"]
    }
  }
};