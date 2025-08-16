// src/web3/local.js
import { ethers } from 'ethers';

// Use env vars so keys never get committed. For quick local hack, you can hardcode.
const RPC_URL = import.meta.env.VITE_LOCAL_RPC_URL || 'http://127.0.0.1:8545';
const USER_PK = import.meta.env.VITE_USER_PK || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Account #0
const MM_PK   = import.meta.env.VITE_MM_PK   || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Account #1

export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const userWallet = new ethers.Wallet(USER_PK, provider);
export const mmWallet   = new ethers.Wallet(MM_PK, provider);
