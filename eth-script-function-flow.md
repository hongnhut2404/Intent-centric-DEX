# ETH-Script Function Call Flow Diagram

## Overview
This diagram shows the function call flow for `eth-script.txt` in the Intent-centric DEX system.

```mermaid
graph TD
    A[Start eth-script.txt] --> B[deployIntentMatching.js]
    B --> C[setMarketMaker.js]
    C --> D[createBuyIntent.js]
    D --> E[createSellIntent.js]
    E --> F[viewAllIntents.js]
    F --> G[matchingIntentComponent.js]
    G --> H[deployMultisigWallet.js]
    H --> I[deployHTLC.js]
    I --> J[fund.js]
    J --> K[createHTLC.js]
    K --> L[viewHTLC.js]

    %% Contract Function Calls
    B --> B1[IntentMatching.deploy()]
    B1 --> B2[Save address to JSON]
    
    C --> C1[contract.setMarketMaker(account1)]
    
    D --> D1[contract.createBuyIntent()]
    D1 --> D2[sellAmount: 8 BTC]
    D1 --> D3[minBuyAmount: 40 ETH]
    D1 --> D4[locktime: now + 90s]
    D1 --> D5[slippage: 0%]
    
    E --> E1[contract.createSellIntent()]
    E1 --> E2[sellAmount: 100/50/10 ETH]
    E1 --> E3[minBuyAmount: 4/2/0.35 BTC]
    E1 --> E4[deadline: now + 3600s]
    
    G --> G1[contract.matchIntent(buyId=0)]
    G1 --> G2[Execute matching algorithm]
    G2 --> G3[Emit TradeMatched events]
    
    H --> H1[MultisigWallet.deploy()]
    H1 --> H2[owners: accounts[1,2]]
    H1 --> H3[required: 2]
    H2 --> H4[intentMatching.setMultisigWallet()]
    
    I --> I1[HTLC.deploy(multisigAddress)]
    I1 --> I2[intentMatching.setHTLCAddress()]
    
    J --> J1[sender.sendTransaction()]
    J1 --> J2[Fund multisig with 1000 ETH]
    
    K --> K1[Generate secrets & hashes]
    K1 --> K2[multisig.submitTransaction()]
    K2 --> K3[htlc.newLock()]
    K3 --> K4[multisig.confirmTransaction()]
    K4 --> K5[multisig.executeTransaction()]
    K5 --> K6[intentMatching.associateHTLC()]
    
    L --> L1[htlc.getAllHTLCs()]
    L1 --> L2[Display HTLC details]

    %% Styling
    classDef scriptBox fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef contractCall fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dataFlow fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    
    class A,B,C,D,E,F,G,H,I,J,K,L scriptBox
    class B1,C1,D1,E1,G1,G2,H1,I1,J1,K1,K2,K3,K4,K5,K6,L1 contractCall
    class B2,D2,D3,D4,D5,E2,E3,E4,G3,H2,H3,H4,I2,J2,L2 dataFlow
```

## Detailed Function Call Analysis

### 1. Contract Deployment Phase
```
deployIntentMatching.js
├── IntentMatching.deploy()
├── intentMatching.waitForDeployment()
├── intentMatching.getAddress()
└── fs.writeFileSync("intent-matching-address.json")
```

### 2. Configuration Phase
```
setMarketMaker.js
├── fs.readFileSync("intent-matching-address.json")
├── IntentMatching.attach(address)
├── contract.connect(owner).setMarketMaker(mmSigner.address)
└── contract.marketMaker() // verification
```

### 3. Intent Creation Phase
```
createBuyIntent.js
├── contract.connect(user1).createBuyIntent(
│   ├── sellAmount: 8 BTC (8e8 satoshi)
│   ├── minBuyAmount: 40 ETH (parseEther)
│   ├── locktime: now + 90 seconds
│   ├── offchainId: "buy-eth"
│   └── slippage: 0%
└── Parse BuyIntentCreated event

createSellIntent.js
├── contract.connect(marketMaker).createSellIntent(
│   ├── sellAmount: [100, 50, 10] ETH
│   ├── minBuyAmount: [4, 2, 0.35] BTC
│   ├── deadline: now + 3600 seconds
│   └── offchainId: unique per intent
└── Parse SellIntentCreated events
```

### 4. Intent Matching Phase
```
matchingIntentComponent.js
├── contract.connect(executor).matchIntent(buyIntentId=0)
├── Smart contract matching algorithm:
│   ├── Calculate rate bounds with slippage
│   ├── Find compatible sell intents
│   ├── Sort by rate (highest first)
│   ├── Fill buy intent across multiple sells
│   └── Update intent statuses
└── Emit TradeMatched events
```

### 5. Infrastructure Deployment Phase
```
deployMultisigWallet.js
├── MultisigWallet.deploy(owners[], required=2)
├── multisig.waitForDeployment()
├── intentMatching.setMultisigWallet(multisigAddress)
└── Verification: intentMatching.multisigWallet()

deployHTLC.js
├── HTLC.deploy(multisigAddress)
├── htlc.waitForDeployment()
├── intentMatching.setHTLCAddress(htlcAddress)
└── Store HTLC address on-chain
```

### 6. HTLC Funding & Creation Phase
```
fund.js
├── sender.sendTransaction({
│   ├── to: multisigAddress
│   └── value: 1000 ETH
└── Check multisig balance

createHTLC.js
├── Load matched trades for buyIntentId
├── Generate base secret + per-trade hashes
├── For each matched trade:
│   ├── multisig.submitTransaction(htlc.newLock)
│   ├── multisig.confirmTransaction() × required
│   ├── multisig.executeTransaction()
│   ├── Parse Locked event for lockId
│   ├── multisig.submitTransaction(associateHTLC)
│   ├── multisig.confirmTransaction() × required
│   └── multisig.executeTransaction()
└── Save exchange-data.json
```

### 7. Verification Phase
```
viewHTLC.js
├── htlc.getAllHTLCs()
└── Display HTLC details:
    ├── recipient addresses
    ├── secret hashes
    ├── locked amounts
    └── timelocks
```

## Key Smart Contract Functions Called

### IntentMatching Contract
- `deploy()` - Deploy contract
- `setMarketMaker(address)` - Set MM permissions
- `createBuyIntent(uint256, uint256, uint256, bytes32, uint256)` - Create buy order
- `createSellIntent(uint256, uint256, uint256, bytes32)` - Create sell order
- `matchIntent(uint256)` - Execute matching algorithm
- `setMultisigWallet(address)` - Set multisig address
- `setHTLCAddress(address)` - Set HTLC contract address
- `associateHTLC(uint256, bytes32, address, bytes32)` - Link HTLC to trade

### MultisigWallet Contract
- `deploy(address[], uint256)` - Deploy with owners & threshold
- `submitTransaction(address, uint256, bytes)` - Propose transaction
- `confirmTransaction(uint256)` - Confirm proposed transaction
- `executeTransaction(uint256)` - Execute confirmed transaction

### HTLC Contract
- `deploy(address)` - Deploy with authorized caller
- `newLock(address, bytes32, uint256)` - Create time-locked contract
- `getAllHTLCs()` - View all locked contracts

## Data Flow Summary

1. **Addresses**: Saved to JSON files for cross-script communication
2. **Secrets**: Generated and hashed for HTLC security
3. **Trade Data**: Matched trades create HTLC parameters
4. **Events**: Contract events provide transaction confirmations
5. **State Files**: Exchange metadata persisted for Bitcoin script

This flow establishes the complete Ethereum-side infrastructure for cross-chain atomic swaps.
