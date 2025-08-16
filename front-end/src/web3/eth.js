import { ethers } from 'ethers';
import IntentMatchingABI from '../contracts/IntentMatching.json';
import MultisigABI from '../contracts/MultisigWallet.json';
import HTLCABI from '../contracts/HTLC.json';
import intentAddr from '../contracts/intent-matching-address.json';

export async function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask not detected');
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  return provider;
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getIntentMatching() {
  const signer = await getSigner();
  return new ethers.Contract(intentAddr.address, IntentMatchingABI.abi, signer);
}

// 🔽 Read addresses FROM CHAIN (no local JSON for these)
export async function getMultisig() {
  const signer = await getSigner();
  const intent = await getIntentMatching();
  const addr = await intent.multisigWallet();   // matches your public var
  if (!addr || addr === ethers.ZeroAddress) throw new Error('Multisig not set');
  return new ethers.Contract(addr, MultisigABI.abi, signer);
}

export async function getHTLC() {
  const signer = await getSigner();
  const intent = await getIntentMatching();
  const addr = await intent.htlcAddress();      // matches your public var
  if (!addr || addr === ethers.ZeroAddress) throw new Error('HTLC not set');
  return new ethers.Contract(addr, HTLCABI.abi, signer);
}

// handy unit helpers
export const toSats = (s) => ethers.parseUnits(String(s || '0'), 8);
export const toWei  = (s) => ethers.parseUnits(String(s || '0'), 18);
export const fmtEth = (wei) => ethers.formatEther(wei);
