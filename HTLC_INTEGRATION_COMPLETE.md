# HTLC Operations Guide

This document explains how the HTLC (Hash Time Locked Contract) system integrates with your Intent-centric DEX frontend.

## 🔧 File Structure Analysis

### Backend Scripts (Hardhat)
```
my-solidity-project/localhost-script/htlc/
├── deployHTLC.js          # Deploys HTLC contract
├── fund.js                # Funds multisig wallet
├── createHTLC.js          # Creates HTLCs for matched trades  
├── createHTLC-enhanced.js # Enhanced version with UI callbacks
├── viewHTLC.js            # Views all active HTLCs
├── withdrawHTLC.js        # Withdraws HTLCs using secrets
├── refundHTLC.js          # Refunds expired HTLCs
└── revealSecret.js        # Reveals secrets for withdrawal
```

### Frontend Components
```
front-end/src/components/
├── HTLCManager/
│   ├── HTLCManager.jsx    # Main HTLC dashboard
│   ├── HTLCCard.jsx       # Individual HTLC display
│   ├── HTLCManager.css    # Dashboard styling
│   └── HTLCCard.css       # Card styling
└── SwapCard/
    └── SwapCard.jsx       # Enhanced with HTLC integration
```

### Utilities & Context
```
front-end/src/
├── web3/
│   └── LocalSignerContext.jsx  # Contract loading & management
├── utils/
│   └── htlcUtils.js            # HTLC helper functions
└── public/data/
    └── intent-matching-address.json  # Contract addresses
```

## 🚀 Deployment Workflow

### 1. Deploy HTLC Infrastructure
```bash
cd my-solidity-project

# Run complete deployment
./deploy-htlc.sh

# Or run individual steps:
echo "Deploying HTLC contract..."
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost

echo "Funding multisig wallet..."  
npx hardhat run localhost-script/htlc/fund.js --network localhost

echo "Viewing HTLCs..."
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost
```

### 2. Start Frontend
```bash
cd front-end
npm install
npm run dev
```

## 🔄 UI Integration Flow

### Automatic HTLC Creation
When intents match in the UI:

1. **Intent Matching Detection**
   - `SwapCard.jsx` listens for `IntentMatched` events
   - Automatically triggers HTLC creation process

2. **Secret Generation & Storage**
   ```javascript
   // In SwapCard.jsx
   const secret = generateRandomSecret(6);
   const { keccak256: secretHash } = generateSecretHashes(secret);
   storeSecret(`htlc_secret_${buyIntentId}`, secret);
   ```

3. **HTLC Contract Interaction**
   ```javascript
   // Via enhanced LocalSignerContext
   const htlc = contracts.htlc;
   const tx = await htlc.newLock(recipient, secretHash, lockDuration, { value: amount });
   ```

### Real-Time HTLC Monitoring
The `HTLCManager` component provides:

1. **Live Status Updates**
   ```javascript
   // Event listeners in HTLCManager.jsx
   contracts.htlc.on('Locked', handleNewHTLC);
   contracts.htlc.on('SecretRevealed', handleSecretRevealed);
   contracts.htlc.on('Withdrawn', handleWithdrawn);
   ```

2. **Interactive Controls**
   - 🔓 Reveal Secret buttons
   - 💰 Withdraw buttons  
   - ↩️ Refund buttons (for expired HTLCs)

3. **Status Indicators**
   - 🔒 **Locked**: HTLC created, awaiting secret reveal
   - 🔓 **Secret Revealed**: Secret broadcast, ready for withdrawal
   - ✅ **Withdrawn**: Funds successfully claimed
   - ↩️ **Refunded**: Expired HTLC refunded

## 📊 Cross-Chain Data Flow

### Data Synchronization
HTLCs coordinate between Ethereum and Bitcoin via shared data files:

```javascript
// Exchange data saved to multiple locations
const exportPaths = [
  "../../../bitcoin-chain/data-script/exchange-data.json",  // Bitcoin scripts
  "../../data/exchange-data.json",                          // Hardhat data
  "../../front-end/public/data/exchange-data.json"         // UI access
];
```

### Exchange Data Structure
```json
{
  "success": true,
  "timestamp": 1692196800000,
  "buyIntentId": 0,
  "htlcs": [{
    "lockId": "0",
    "locktime": 1692200400,
    "secret": "abc123",
    "hashKeccak": "0x...",  // For Ethereum
    "hashSha256": "...",    // For Bitcoin  
    "btcAmount": 0.001,
    "recipient": "0x...",
    "ethAmount": "0.1"
  }]
}
```

## 🎯 Manual HTLC Operations

### Create HTLCs for Specific Intent
```bash
# Create HTLC for buy intent ID 0
BUY_ID=0 npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
```

### Monitor HTLC Status  
```bash
# View all active HTLCs
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost
```

### Reveal Secret (Bitcoin -> Ethereum)
```bash  
# Reveal secret to enable withdrawals
npx hardhat run localhost-script/htlc/revealSecret.js --network localhost
```

### Withdraw Funds
```bash
# Withdraw ETH using revealed secret
BUY_ID=0 npx hardhat run localhost-script/htlc/withdrawHTLC.js --network localhost
```

### Refund Expired HTLCs
```bash
# Refund expired HTLCs back to sender
npx hardhat run localhost-script/htlc/refundHTLC.js --network localhost
```

## 🔒 Security Features

### Multi-Signature Protection
- All HTLC operations require multisig approval
- Prevents single-point-of-failure
- Configurable threshold signatures

### Timelock Safety
- HTLCs automatically expire after locktime
- Expired HTLCs can be safely refunded
- No risk of permanently locked funds

### Secret Management
- Secrets generated cryptographically secure
- Dual-hash support (Keccak256 + SHA256)
- Secure storage patterns (upgrade for production)

## 🎮 UI Testing Workflow

1. **Start Local Blockchain & Deploy**
   ```bash
   # Terminal 1: Start Hardhat node
   npx hardhat node
   
   # Terminal 2: Deploy contracts
   ./deploy-htlc.sh
   ```

2. **Launch Frontend**
   ```bash
   # Terminal 3: Start React app
   cd front-end && npm run dev
   ```

3. **Test Complete Flow**
   - Connect as User → Create Buy Intent
   - Connect as Market Maker → Create Sell Intent  
   - Watch automatic HTLC creation
   - Monitor in HTLC Status tab
   - Test secret revelation and withdrawal

## 🚨 Production Considerations

### Security Upgrades
- Replace localStorage with secure key management
- Implement proper secret derivation
- Add comprehensive error handling
- Audit all smart contracts

### Performance Optimization  
- Batch HTLC operations where possible
- Implement WebSocket for real-time updates
- Add pagination for large HTLC lists
- Optimize gas usage

### Monitoring & Alerting
- Add comprehensive logging
- Implement HTLC expiry monitoring
- Set up automated refund processes
- Create operational dashboards

This guide provides the complete picture of how HTLC functionality integrates between your backend scripts and frontend UI, enabling seamless atomic swaps with full user visibility and control.
