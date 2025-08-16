import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Contract ABIs and addresses
const loadContractData = () => {
  try {
    const intentMatchingAddress = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/intent-matching-address.json'), 'utf8')
    );
    
    const IntentMatchingABI = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../contracts/IntentMatching.json'), 'utf8')
    );
    
    const HTLCABI = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../contracts/HTLC.json'), 'utf8')
    );
    
    return {
      intentMatchingAddress: intentMatchingAddress.address,
      IntentMatchingABI: IntentMatchingABI.abi,
      HTLCABI: HTLCABI.abi
    };
  } catch (error) {
    console.error('Error loading contract data:', error);
    return null;
  }
};

// Provider setup for localhost
const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// Utility function to get signers
const getSigners = async () => {
  const accounts = await provider.listAccounts();
  return accounts.map(account => new ethers.Wallet(account.privateKey || '0x' + '0'.repeat(64), provider));
};

// Generate random secret
const generateRandomSecret = (length = 6) => {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randIndex = Math.floor(Math.random() * charset.length);
    result += charset[randIndex];
  }
  return result;
};

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Deploy HTLC contract
app.post('/api/htlc/deploy', async (req, res) => {
  try {
    const contractData = loadContractData();
    if (!contractData) {
      return res.status(500).json({ error: 'Failed to load contract data' });
    }

    const signers = await getSigners();
    const deployer = signers[0];

    // Load IntentMatching contract
    const intentMatching = new ethers.Contract(
      contractData.intentMatchingAddress,
      contractData.IntentMatchingABI,
      deployer
    );

    // Get multisig address
    const multisigAddress = await intentMatching.multisigWallet();
    if (!multisigAddress || multisigAddress === ethers.ZeroAddress) {
      return res.status(400).json({ error: 'Multisig wallet not set in IntentMatching contract' });
    }

    // Deploy HTLC contract
    const HTLCFactory = new ethers.ContractFactory(
      contractData.HTLCABI,
      req.body.bytecode || '', // You might need to provide bytecode
      deployer
    );

    const htlc = await HTLCFactory.deploy(multisigAddress);
    await htlc.waitForDeployment();
    const htlcAddress = await htlc.getAddress();

    // Register HTLC address in IntentMatching
    const tx = await intentMatching.setHTLCAddress(htlcAddress);
    await tx.wait();

    res.json({
      success: true,
      htlcAddress,
      multisigAddress,
      transactionHash: tx.hash,
      message: 'HTLC contract deployed and registered successfully'
    });
  } catch (error) {
    console.error('Deploy HTLC error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fund HTLC (multisig wallet)
app.post('/api/htlc/fund', async (req, res) => {
  try {
    const { amount = '1000.0' } = req.body;
    const contractData = loadContractData();
    if (!contractData) {
      return res.status(500).json({ error: 'Failed to load contract data' });
    }

    const signers = await getSigners();
    const sender = signers[0];

    const intentMatching = new ethers.Contract(
      contractData.intentMatchingAddress,
      contractData.IntentMatchingABI,
      sender
    );

    const multisigAddress = await intentMatching.multisigWallet();
    if (!multisigAddress || multisigAddress === ethers.ZeroAddress) {
      return res.status(400).json({ error: 'Multisig wallet not found' });
    }

    const tx = await sender.sendTransaction({
      to: multisigAddress,
      value: ethers.parseEther(amount)
    });

    const receipt = await tx.wait();
    const balance = await provider.getBalance(multisigAddress);

    res.json({
      success: true,
      transactionHash: receipt.hash,
      multisigAddress,
      newBalance: ethers.formatEther(balance),
      message: `Multisig funded with ${amount} ETH`
    });
  } catch (error) {
    console.error('Fund HTLC error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create HTLCs for matched trades
app.post('/api/htlc/create', async (req, res) => {
  try {
    const { buyIntentId = 0 } = req.body;
    const contractData = loadContractData();
    if (!contractData) {
      return res.status(500).json({ error: 'Failed to load contract data' });
    }

    const signers = await getSigners();
    const intentMatching = new ethers.Contract(
      contractData.intentMatchingAddress,
      contractData.IntentMatchingABI,
      signers[0]
    );

    // Get matched trade count
    const matchedTradeCount = await intentMatching.matchedTradeCount();
    if (matchedTradeCount === 0n) {
      return res.status(400).json({ error: 'No matched trades found' });
    }

    // Generate secret
    const secret = generateRandomSecret();
    const hashKeccak = ethers.keccak256(ethers.toUtf8Bytes(secret));
    const hashSha256 = require('crypto').createHash('sha256').update(secret).digest('hex');

    const htlcMetadata = [];
    let created = 0;

    // Process trades for the given buyIntentId
    for (let i = 0n; i < matchedTradeCount; i++) {
      const trade = await intentMatching.matchedTrades(i);
      if (trade.buyIntentId !== BigInt(buyIntentId)) continue;

      // This is a simplified version - in reality, you'd need to interact with multisig
      const htlcData = {
        lockId: `${i}_${Date.now()}`,
        recipient: trade.recipient,
        secretHash: hashKeccak,
        amount: ethers.formatEther(trade.ethAmount),
        locktime: Number(trade.locktime),
        secret,
        hashSha256,
        btcAmount: Number(trade.btcAmount) / 1e8
      };

      htlcMetadata.push(htlcData);
      created++;
    }

    // Save metadata for Bitcoin side
    const exchangeDataPath = path.join(__dirname, '../../../bitcoin-chain/data-script/exchange-data.json');
    const exchangeDir = path.dirname(exchangeDataPath);
    
    if (!fs.existsSync(exchangeDir)) {
      fs.mkdirSync(exchangeDir, { recursive: true });
    }

    fs.writeFileSync(exchangeDataPath, JSON.stringify({ 
      success: true, 
      htlcs: htlcMetadata 
    }, null, 2));

    res.json({
      success: true,
      htlcs: htlcMetadata,
      secret,
      hashKeccak,
      hashSha256,
      created,
      message: `Created ${created} HTLC(s) for BuyIntent ${buyIntentId}`
    });
  } catch (error) {
    console.error('Create HTLC error:', error);
    res.status(500).json({ error: error.message });
  }
});

// View all HTLCs
app.get('/api/htlc/view', async (req, res) => {
  try {
    const contractData = loadContractData();
    if (!contractData) {
      return res.status(500).json({ error: 'Failed to load contract data' });
    }

    const signers = await getSigners();
    const intentMatching = new ethers.Contract(
      contractData.intentMatchingAddress,
      contractData.IntentMatchingABI,
      signers[0]
    );

    const htlcAddress = await intentMatching.htlcAddress();
    
    if (!htlcAddress || htlcAddress === ethers.ZeroAddress) {
      return res.json({
        success: true,
        htlcs: [],
        message: 'HTLC contract not deployed yet'
      });
    }

    const htlc = new ethers.Contract(htlcAddress, contractData.HTLCABI, signers[0]);
    const htlcs = await htlc.getAllHTLCs();

    const formattedHTLCs = htlcs.map((htlc, index) => ({
      id: index,
      recipient: htlc.recipient,
      secretHash: htlc.secretHash,
      amount: ethers.formatEther(htlc.amount),
      timelock: new Date(Number(htlc.timelock) * 1000).toLocaleString(),
      timelockRaw: Number(htlc.timelock),
      isExpired: Number(htlc.timelock) < Math.floor(Date.now() / 1000)
    }));

    res.json({
      success: true,
      htlcs: formattedHTLCs,
      count: formattedHTLCs.length,
      htlcContractAddress: htlcAddress,
      message: formattedHTLCs.length === 0 ? 'No HTLCs found' : `Found ${formattedHTLCs.length} HTLC(s)`
    });
  } catch (error) {
    console.error('View HTLCs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get HTLC system status
app.get('/api/htlc/status', async (req, res) => {
  try {
    const contractData = loadContractData();
    if (!contractData) {
      return res.status(500).json({ error: 'Failed to load contract data' });
    }

    const signers = await getSigners();
    const intentMatching = new ethers.Contract(
      contractData.intentMatchingAddress,
      contractData.IntentMatchingABI,
      signers[0]
    );

    const htlcAddress = await intentMatching.htlcAddress();
    const multisigAddress = await intentMatching.multisigWallet();
    
    const multisigBalance = multisigAddress !== ethers.ZeroAddress 
      ? await provider.getBalance(multisigAddress)
      : 0n;

    res.json({
      success: true,
      htlcDeployed: htlcAddress !== ethers.ZeroAddress,
      htlcAddress,
      multisigAddress,
      multisigBalance: ethers.formatEther(multisigBalance),
      isReady: htlcAddress !== ethers.ZeroAddress && multisigAddress !== ethers.ZeroAddress
    });
  } catch (error) {
    console.error('Get HTLC status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`HTLC API server running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/htlc/status');
  console.log('  GET  /api/htlc/view');
  console.log('  POST /api/htlc/deploy');
  console.log('  POST /api/htlc/fund');
  console.log('  POST /api/htlc/create');
});

export default app;
