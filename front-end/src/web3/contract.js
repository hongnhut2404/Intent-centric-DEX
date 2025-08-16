import { ethers } from 'ethers';
import IntentMatchingABI from '../contracts/IntentMatching.json';
import intentAddr from '../contracts/intent-matching-address.json';

export function intentMatchingWith(signerOrProvider) {
  return new ethers.Contract(intentAddr.address, IntentMatchingABI.abi, signerOrProvider);
}