import { ethers } from 'ethers';
import IntentMatchingABI from "../../contracts/IntentMatching.json";
import contractAddress from '../contracts/intent-matching-address.json';

const CONTRACT_ADDRESS = contractAddress.address;

export async function createBuyIntent(btcAmountRaw, ethAmountRaw, slippage) {
  if (!window.ethereum) throw new Error("MetaMask not detected");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  const contract = new ethers.Contract(CONTRACT_ADDRESS, IntentMatchingABI.abi, signer);

  const btcAmount = ethers.parseUnits(btcAmountRaw, 8);       // 8 decimals for BTC (off-chain)
  const ethAmount = ethers.parseEther(ethAmountRaw);          // ETH: 18 decimals
  const locktime = Math.floor(Date.now() / 1000) + 3600;      // 1 hour in the future
  const offchainId = ethers.id(`offchain-${Date.now()}`);     // unique identifier
  const slippageValue = parseInt(slippage || '0');

  const tx = await contract.createBuyIntent(
    btcAmount,
    ethAmount,
    locktime,
    offchainId,
    slippageValue
  );

  return tx.wait();
}
