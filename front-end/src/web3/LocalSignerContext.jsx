// src/web3/LocalSignerContext.jsx
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { provider, userWallet, mmWallet } from './local';

const LocalSignerCtx = createContext(null);

export function LocalSignerProvider({ children }) {
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load contracts on startup
  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError('');

      // Load contract addresses from JSON files
      const intentResponse = await fetch('/data/intent-matching-address.json');
      if (!intentResponse.ok) throw new Error('Failed to load contract addresses');
      
      const { address: intentMatchingAddress } = await intentResponse.json();

      // Contract ABIs - in a real app, these would be imported from compiled artifacts
      const IntentMatchingABI = [
        "function createBuyIntent(uint256 btcAmount, uint256 ethAmount, uint256 rate, uint256 slippagePercent) external payable",
        "function createSellIntent(uint256 btcAmount, uint256 ethAmount, uint256 rate, uint256 slippagePercent) external",
        "function matchIntent(uint256 buyIntentId) external",
        "function htlcAddress() external view returns (address)",
        "function multisigWallet() external view returns (address)",
        "function getAllBuyIntents() external view returns (tuple(uint256 id, address user, uint256 btcAmount, uint256 ethAmount, uint256 rate, uint256 slippagePercent, bool isActive)[])",
        "function getAllSellIntents() external view returns (tuple(uint256 id, address marketMaker, uint256 btcAmount, uint256 ethAmount, uint256 rate, uint256 slippagePercent, bool isActive)[])",
        "function matchedTrades(uint256) external view returns (tuple(uint256 buyIntentId, uint256 sellIntentId, address recipient, uint256 ethAmount, uint256 btcAmount, uint256 rate, uint256 locktime))",
        "function matchedTradeCount() external view returns (uint256)",
        "function associateHTLC(uint256 buyIntentId, uint256 lockId, address recipient, bytes32 secretHash) external",
        "event IntentMatched(uint256 indexed buyIntentId, uint256 indexed sellIntentId, address indexed recipient, uint256 ethAmount, uint256 btcAmount, uint256 rate)",
        "event HTLCAssociated(uint256 indexed buyIntentId, uint256 indexed lockId, address indexed recipient, bytes32 secretHash)"
      ];

      const HTLCABI = [
        "function newLock(address recipient, bytes32 secretHash, uint256 lockDuration) external payable returns (uint256)",
        "function withdraw(uint256 lockId, bytes calldata secret) external",
        "function refund(uint256 lockId) external",
        "function revealSecret(uint256 lockId, bytes calldata secret) external",
        "function getAllHTLCs() external view returns (tuple(address recipient, bytes32 secretHash, uint256 amount, uint256 timelock)[])",
        "event Locked(uint256 indexed id, address indexed recipient, bytes32 indexed secretHash, uint256 amount, uint256 timelock)",
        "event Withdrawn(uint256 indexed id, address indexed recipient, bytes calldata secret)",
        "event Refunded(uint256 indexed id, address indexed recipient)",
        "event SecretRevealed(uint256 indexed id, bytes calldata secret)"
      ];

      const MultisigABI = [
        "function getOwners() external view returns (address[])",
        "function required() external view returns (uint256)",
        "function submitTransaction(address destination, uint256 value, bytes calldata data) external returns (uint256)",
        "function confirmTransaction(uint256 transactionId) external",
        "function executeTransaction(uint256 transactionId) external",
        "function txCounter() external view returns (uint256)"
      ];

      // Create contract instances
      const intentMatching = new ethers.Contract(intentMatchingAddress, IntentMatchingABI, userWallet);
      
      // Get HTLC and Multisig addresses
      const htlcAddress = await intentMatching.htlcAddress();
      const multisigAddress = await intentMatching.multisigWallet();
      
      const htlc = new ethers.Contract(htlcAddress, HTLCABI, userWallet);
      const multisigWallet = new ethers.Contract(multisigAddress, MultisigABI, userWallet);

      setContracts({
        intentMatching,
        htlc,
        multisigWallet
      });

    } catch (err) {
      setError(`Failed to load contracts: ${err.message}`);
      console.error('Contract loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    provider,
    userSigner: userWallet,
    mmSigner: mmWallet,
    userAddress: userWallet.address,
    mmAddress: mmWallet.address,
    contracts,
    contractsLoading: loading,
    contractsError: error,
    reloadContracts: loadContracts
  }), [contracts, loading, error]);

  return <LocalSignerCtx.Provider value={value}>{children}</LocalSignerCtx.Provider>;
}

export function useLocalSigners() {
  const ctx = useContext(LocalSignerCtx);
  if (!ctx) throw new Error('useLocalSigners must be used inside LocalSignerProvider');
  return ctx;
}

// Alias for backward compatibility with existing code
export const useLocalSigner = useLocalSigners;
