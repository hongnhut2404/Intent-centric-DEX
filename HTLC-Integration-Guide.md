# HTLC Backend Integration Guide

This guide shows how to implement the HTLC deployment steps as backend services and integrate them with the UI.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Backend API    │    │  Blockchain     │
│   (React)       │◄──►│  (Express.js)   │◄──►│  (Hardhat)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
├─ HTLCManager.jsx    ├─ htlc-api-server.js  ├─ HTLC.sol
├─ htlcService.js     ├─ API Endpoints       ├─ IntentMatching.sol
└─ Real-time UI      └─ Contract Interaction└─ MultisigWallet.sol
```

## 📁 File Structure

```
Intent-centric-DEX/
├── front-end/
│   └── src/
│       ├── components/
│       │   └── HTLCManager/           # ✅ New HTLC UI Component
│       │       ├── HTLCManager.jsx
│       │       ├── HTLCManager.css
│       │       └── index.js
│       ├── service/
│       │   └── htlcService.js         # ✅ Frontend HTLC Service
│       └── App.jsx                    # ✅ Updated with HTLC tab
├── my-solidity-project/
│   ├── htlc-api-server.js            # ✅ New Backend API Server
│   ├── package-api.json              # ✅ API Server Dependencies
│   └── localhost-script/htlc/        # Original scripts (reference)
└── bitcoin-chain/                    # Cross-chain integration
```

## 🚀 Step-by-Step Implementation

### Step 1: Deploy HTLC Contract

**Original Script:**
```bash
echo "Deploying HTLC contract..."
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
```

**Backend API:**
- **Endpoint:** `POST /api/htlc/deploy`
- **Function:** Deploys HTLC contract with multisig authorization
- **Response:** Contract address, transaction hash, deployment status

**Frontend Integration:**
- **Component:** `HTLCManager.jsx` → Deploy tab
- **Service:** `htlcService.deployHTLC()`
- **UI Flow:** Click "Deploy HTLC Contract" → Show deployment status → Update system status

### Step 2: Fund HTLC Contract

**Original Script:**
```bash
echo "Funding HTLC contract..."
npx hardhat run localhost-script/htlc/fund.js --network localhost
```

**Backend API:**
- **Endpoint:** `POST /api/htlc/fund`
- **Function:** Funds multisig wallet with ETH for HTLC operations
- **Parameters:** `{ amount: "1000.0" }` (ETH amount to fund)

**Frontend Integration:**
- **Component:** `HTLCManager.jsx` → Fund tab
- **Service:** `htlcService.fundHTLC(amount)`
- **UI Flow:** Input amount → Fund multisig → Display new balance

### Step 3: Create HTLCs for Matched Trades

**Original Script:**
```bash
echo "Creating HTLCs for matched trades..."
npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
```

**Backend API:**
- **Endpoint:** `POST /api/htlc/create`
- **Function:** Creates HTLCs for specific buyIntentId
- **Parameters:** `{ buyIntentId: 0 }`

**Frontend Integration:**
- **Component:** `HTLCManager.jsx` → Create tab
- **Service:** `htlcService.createHTLC(buyIntentId)`
- **UI Flow:** Select intent → Create HTLCs → Display secret & metadata

### Step 4: View All HTLCs

**Original Script:**
```bash
echo "Viewing all HTLCs..."
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost
```

**Backend API:**
- **Endpoint:** `GET /api/htlc/view`
- **Function:** Retrieves all active HTLCs with status
- **Response:** Array of HTLCs with recipient, amount, timelock, expiry status

**Frontend Integration:**
- **Component:** `HTLCManager.jsx` → View tab (default)
- **Service:** `htlcService.viewAllHTLCs()`
- **UI Flow:** Real-time HTLC grid → Status indicators → Action buttons

## 🔧 Backend API Endpoints

### Status & Health
- `GET /health` - API health check
- `GET /api/htlc/status` - System status (deployed, funded, ready)

### HTLC Operations
- `POST /api/htlc/deploy` - Deploy HTLC contract
- `POST /api/htlc/fund` - Fund multisig wallet  
- `POST /api/htlc/create` - Create HTLCs for trades
- `GET /api/htlc/view` - View all HTLCs

### Advanced Operations
- `POST /api/htlc/withdraw` - Withdraw with secret (future)
- `POST /api/htlc/refund` - Refund expired HTLC (future)

## 🎨 Frontend UI Features

### HTLCManager Component
- **Tabbed Interface:** Deploy, Fund, Create, View, Withdraw
- **Status Dashboard:** System readiness, balances, deployment status
- **Real-time Updates:** Auto-refresh HTLC list, live status
- **Responsive Design:** Works on desktop and mobile

### Key UI Elements
- **Status Cards:** Visual indicators for system health
- **HTLC Grid:** Card-based layout for active HTLCs  
- **Action Buttons:** Context-aware operations (withdraw/refund)
- **Form Controls:** Input validation and user feedback

## 🔄 Integration Workflow

### 1. System Setup Flow
```
1. User clicks "Deploy HTLC Contract"
   ↓
2. Frontend calls htlcService.deployHTLC()
   ↓  
3. Service makes POST /api/htlc/deploy
   ↓
4. Backend deploys contract, registers address
   ↓
5. UI updates status, shows success message
```

### 2. Create HTLC Flow
```
1. User selects buyIntentId, clicks "Create HTLCs"
   ↓
2. Frontend calls htlcService.createHTLC(buyIntentId)
   ↓
3. Service makes POST /api/htlc/create
   ↓
4. Backend generates secret, creates HTLCs via multisig
   ↓
5. Metadata saved for Bitcoin side coordination
   ↓
6. UI displays secret, updates HTLC list
```

### 3. Cross-chain Coordination
```
ETH Side (Frontend/Backend)     Bitcoin Side (Scripts)
├─ Create HTLC                  ├─ Read exchange-data.json
├─ Generate secret              ├─ Create Bitcoin HTLC
├─ Save metadata ──────────────►├─ Use same secret hash
└─ Lock ETH funds               └─ Enable atomic swap
```

## 🚦 Running the System

### Start Backend API
```bash
cd my-solidity-project
npm install express cors ethers
node htlc-api-server.js
# API runs on http://localhost:3001
```

### Start Frontend
```bash
cd front-end
npm install
npm run dev
# UI runs on http://localhost:5173
```

### Use the Interface
1. **Connect:** Choose User/MM role
2. **Navigate:** Click "HTLCs" tab
3. **Setup:** Deploy contract, fund multisig
4. **Operate:** Create HTLCs, view status, manage trades

## ✨ Key Benefits

### For Developers
- **Modular Architecture:** Separate concerns (UI, API, blockchain)
- **RESTful APIs:** Standard HTTP endpoints for integration
- **Real-time Updates:** Live status and HTLC monitoring
- **Error Handling:** Comprehensive error reporting and recovery

### For Users  
- **Visual Interface:** No command-line knowledge required
- **Status Transparency:** Clear system health indicators
- **Guided Workflow:** Step-by-step HTLC creation process
- **Cross-chain Coordination:** Seamless Bitcoin integration

### For System Operators
- **Monitoring Dashboard:** Real-time system status
- **Batch Operations:** Handle multiple trades efficiently  
- **Safety Features:** Timeout handling, refund mechanisms
- **Audit Trail:** Complete transaction history

## 🔐 Security Considerations

- **Multisig Protection:** All HTLC operations require multisig approval
- **Secret Management:** Secure generation and storage of swap secrets
- **Timeout Handling:** Automatic refund after expiry
- **Input Validation:** Comprehensive parameter validation
- **Error Recovery:** Graceful handling of failed operations

## 📈 Future Enhancements

- **WebSocket Integration:** Real-time HTLC updates without polling
- **Advanced Filtering:** Search and filter HTLCs by status/amount
- **Analytics Dashboard:** Trade volume, success rates, performance metrics
- **Mobile App:** React Native version for mobile access
- **Automated Market Making:** AI-powered trade matching and execution

This implementation bridges the gap between command-line scripts and user-friendly interface, making HTLC operations accessible to all users while maintaining the security and reliability of the underlying smart contracts.
