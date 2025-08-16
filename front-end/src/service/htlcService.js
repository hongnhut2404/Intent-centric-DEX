import { ethers } from 'ethers';
import HTLCAbi from '../contracts/HTLC.json';
import IntentMatchingABI from '../contracts/IntentMatching.json';
import contractAddress from '../contracts/intent-matching-address.json';

const CONTRACT_ADDRESS = contractAddress.address;

class HTLCService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.intentMatchingContract = null;
    this.htlcContract = null;
    this.htlcAddress = null;
  }

  async initialize() {
    if (!window.ethereum) throw new Error("MetaMask not detected");
    
    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    
    // Initialize IntentMatching contract
    this.intentMatchingContract = new ethers.Contract(
      CONTRACT_ADDRESS, 
      IntentMatchingABI.abi, 
      this.signer
    );
    
    // Get HTLC address from IntentMatching contract
    this.htlcAddress = await this.intentMatchingContract.htlcAddress();
    
    // Initialize HTLC contract
    this.htlcContract = new ethers.Contract(
      this.htlcAddress, 
      HTLCAbi.abi, 
      this.signer
    );
  }

  // Deploy HTLC contract (admin only)
  async deployHTLC() {
    try {
      await this.initialize();
      
      // Get multisig address from IntentMatching
      const multisigAddress = await this.intentMatchingContract.multisigWallet();
      if (!multisigAddress || multisigAddress === ethers.ZeroAddress) {
        throw new Error("Multisig wallet not set in IntentMatching contract");
      }

      // Deploy HTLC contract
      const HTLCFactory = new ethers.ContractFactory(
        HTLCAbi.abi, 
        HTLCAbi.bytecode, 
        this.signer
      );
      
      const htlc = await HTLCFactory.deploy(multisigAddress);
      await htlc.waitForDeployment();
      
      const htlcAddress = await htlc.getAddress();
      
      // Register HTLC address in IntentMatching
      const tx = await this.intentMatchingContract.setHTLCAddress(htlcAddress);
      await tx.wait();
      
      return {
        success: true,
        htlcAddress,
        transactionHash: tx.hash,
        message: "HTLC contract deployed and registered successfully"
      };
    } catch (error) {
      console.error('Deploy HTLC error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fund HTLC contract (via multisig)
  async fundHTLC(amount = "1000.0") {
    try {
      await this.initialize();
      
      const multisigAddress = await this.intentMatchingContract.multisigWallet();
      if (!multisigAddress || multisigAddress === ethers.ZeroAddress) {
        throw new Error("Multisig wallet not found");
      }

      const tx = await this.signer.sendTransaction({
        to: multisigAddress,
        value: ethers.parseEther(amount)
      });

      const receipt = await tx.wait();
      const balance = await this.provider.getBalance(multisigAddress);

      return {
        success: true,
        transactionHash: receipt.hash,
        multisigAddress,
        newBalance: ethers.formatEther(balance),
        message: `Multisig funded with ${amount} ETH`
      };
    } catch (error) {
      console.error('Fund HTLC error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create HTLC for matched trades
  async createHTLC(buyIntentId = 0) {
    try {
      await this.initialize();
      
      // Get matched trade count
      const matchedTradeCount = await this.intentMatchingContract.matchedTradeCount();
      if (matchedTradeCount === 0n) {
        throw new Error("No matched trades found");
      }

      // Generate secret
      const secret = this.generateRandomSecret();
      const hashKeccak = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      const createdHTLCs = [];
      const errors = [];

      // Find trades for this buyIntentId and create HTLCs
      for (let i = 0n; i < matchedTradeCount; i++) {
        try {
          const trade = await this.intentMatchingContract.matchedTrades(i);
          if (trade.buyIntentId !== BigInt(buyIntentId)) continue;

          // This would normally be done through multisig
          // For UI demo, we'll simulate the process
          const htlcData = {
            lockId: `htlc_${i}_${Date.now()}`,
            recipient: trade.recipient,
            secretHash: hashKeccak,
            amount: ethers.formatEther(trade.ethAmount),
            locktime: Number(trade.locktime),
            secret: secret,
            btcAmount: Number(trade.btcAmount) / 1e8
          };

          createdHTLCs.push(htlcData);
        } catch (error) {
          errors.push(`Trade ${i}: ${error.message}`);
        }
      }

      return {
        success: true,
        htlcs: createdHTLCs,
        secret: secret,
        hashKeccak: hashKeccak,
        errors: errors.length > 0 ? errors : null,
        message: `Created ${createdHTLCs.length} HTLC(s) for BuyIntent ${buyIntentId}`
      };
    } catch (error) {
      console.error('Create HTLC error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // View all HTLCs
  async viewAllHTLCs() {
    try {
      await this.initialize();
      
      if (!this.htlcAddress || this.htlcAddress === ethers.ZeroAddress) {
        return {
          success: true,
          htlcs: [],
          message: "HTLC contract not deployed yet"
        };
      }

      const htlcs = await this.htlcContract.getAllHTLCs();
      
      const formattedHTLCs = htlcs.map((htlc, index) => ({
        id: index,
        recipient: htlc.recipient,
        secretHash: htlc.secretHash,
        amount: ethers.formatEther(htlc.amount),
        timelock: new Date(Number(htlc.timelock) * 1000).toLocaleString(),
        timelockRaw: Number(htlc.timelock),
        isExpired: Number(htlc.timelock) < Math.floor(Date.now() / 1000)
      }));

      return {
        success: true,
        htlcs: formattedHTLCs,
        count: formattedHTLCs.length,
        htlcContractAddress: this.htlcAddress,
        message: formattedHTLCs.length === 0 ? "No HTLCs found" : `Found ${formattedHTLCs.length} HTLC(s)`
      };
    } catch (error) {
      console.error('View HTLCs error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Withdraw from HTLC (reveal secret)
  async withdrawHTLC(lockId, secret) {
    try {
      await this.initialize();
      
      const tx = await this.htlcContract.withdraw(lockId, ethers.toUtf8Bytes(secret));
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        message: "Successfully withdrew from HTLC"
      };
    } catch (error) {
      console.error('Withdraw HTLC error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Refund HTLC (after timeout)
  async refundHTLC(lockId) {
    try {
      await this.initialize();
      
      const tx = await this.htlc.refund(lockId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        message: "Successfully refunded HTLC"
      };
    } catch (error) {
      console.error('Refund HTLC error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility function to generate random secret
  generateRandomSecret(length = 6) {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      const randIndex = Math.floor(Math.random() * charset.length);
      result += charset[randIndex];
    }
    return result;
  }

  // Get HTLC contract status
  async getHTLCStatus() {
    try {
      await this.initialize();
      
      const htlcAddress = await this.intentMatchingContract.htlcAddress();
      const multisigAddress = await this.intentMatchingContract.multisigWallet();
      const multisigBalance = multisigAddress !== ethers.ZeroAddress 
        ? await this.provider.getBalance(multisigAddress)
        : 0n;

      return {
        success: true,
        htlcDeployed: htlcAddress !== ethers.ZeroAddress,
        htlcAddress: htlcAddress,
        multisigAddress: multisigAddress,
        multisigBalance: ethers.formatEther(multisigBalance),
        isReady: htlcAddress !== ethers.ZeroAddress && multisigAddress !== ethers.ZeroAddress
      };
    } catch (error) {
      console.error('Get HTLC status error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default HTLCService;
