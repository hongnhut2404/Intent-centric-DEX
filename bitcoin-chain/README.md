# Cross-chain Atomic Swap: Ethereum (Hardhat) ↔ Bitcoin Core (RegTest)

## Implement package
go get github.com/joho/godotenv
dnf install tmux

## Workflow
- Step 0: Setup
In Ethereum node, setup a list of Buy Intent(s) and Sell Intent(s) (Intents are generated hardcode in code)
Buy Intent is created by User to sell BTC, buy ETH
Sell Intent is created by Solver to sell ETH, buy BTC

- Step 1: Intent Matching
Use an algorithm to match the Buy Intent with a list of Sell Intent(s) 
After the Intents are matched, the information about the Intent Matching is stored in a htlc-initiate.json file

- Step 2: Create and deploy the HTLC
Alice (Solver) deploy the HTLC to receive the address of HTLC contract instance 
Use that address and Intent Matching data to create the HTLC for 2 parties. The information about HTLC (secret preimage, secret hash, HTLC address, etc)

- Step 3: Exchange data
The secret hash, lockID, timelock, amount BTC needed will be stored in exchange-data.json to give to Bob (User)

- Step 4: Bob create HTLC
Bob receives the information in exchange data to create a HTLC in Bitcoin chain

- Step 5: Alice claim BTC
Alice will use the secret preimage to create a redeem transaction -> sign that transaction -> broadcase transaction via sendrawtransaction -> Alice claim the BTC from Bob

- Step 6: Alice public preimage
Alice will public preimage through json file and send to Bob

- Step 7: Bob claim ETH
Bob use preimage to create a withdrawHTLC to claim ETH


## Step 1. Start Ethereum Node
```bash
npx hardhat node
```

## Step 2. Deploy IntentMatching Contract
```bash
npx hardhat run localhost-script/matching-intent/deployIntentMatching.js --network localhost
```
After deploying, the address of contract will be stored in my-solidity-project/data/intent-matching-address.json

## Step 3. Create Intents
Note:
- Input of BuyIntents and SellIntents is currently implemented in hard code
```bash
npx hardhat run localhost-script/matching-intent/createBuyIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/createSellIntent.js --network localhost
```

## Step 4. Run Intent Matching
```bash
npx hardhat run localhost-script/matching-intent/matchingIntentComponent.js --network localhost

```

## Step 5. Deploy HTLC Contract
Alice deploys the HTLC contract and retrieves the address.

```bash
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
# Output: HTLC contract address
```

## Step 6. Create HTLC (ETH Lock by Alice)
Alice creates the HTLC on-chain.

```bash
npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
# Input: htlcAddress, recipient address, timelock
# Output: secret (preimage), hash(secret) (sha256)
```

---

## Step 7. Start Bitcoin Chain in tmux
```bash
cd bitcoin-chain
mux start -p ../.tmuxinator/bitcoin-chain-execute.yml
```

## Step 8. Initialize Alice and Bob Keys
```bash
cd src/payment-channel
go run main.go init alice
go run main.go init bob
```

## Step 9. Fund Bob’s Wallet
```bash
cd ../..
tmux send-keys -t bitcoin-chain-execute:bash.2 "./commands/fund-wallet.sh" C-m
```

## Step 10. Create Multisig Address
```bash
cd src/payment-channel
go run main.go multisig
```

## Step 11. Fund the Multisig (Off-chain)
```bash
go run main.go fund-offchain 10
```

## Step 12. Set Funding Tx for HTLC
```bash
bitcoin-cli decoderawtransaction <signed_funding_tx>
go run main.go set-htlc-tx <txid> <vout>
```
## Step 13. Broadcast Funding Tx
```bash
bitcoin-cli sendrawtransaction <signed_funding_tx>
```

## Step 14. Commitment Transaction (Optional for off-chain balance)
```bash
bitcoin-cli sendrawtransaction <signed_funding_tx>
```
## Step 15. Settle (Simulate On-chain)
```bash
go run main.go settle
bitcoin-cli generate 1
```

## Note
### Overview
- In this repo, we demonstrate the ETH localhost chain and Bitcoin Core is 2 sepereted folder
- There is still no payment channel to exchange the json file for information
- There is still no option to resolve the conflict

### Ethereum
- There are still some problems with Intent Matching Algorithm
- The generation of Buy Intent and Sell Intent is implemented directly in code (hard code) -> need to be changed into a function

### Bitcoin
- Still implemted the amount of BTC in hard code -> need to change into reading the amount from json files

## How to setup the payment channel
```bash
# 0. Remove the current data folder

# 1. Start tmux session for Bitcoin Core regtest
cd bitcoin-chain
mux start -p ../.tmuxinator/bitcoin-chain-execute.yml

# 2. Generate Alice and Bob keys (creates data/state.json)
cd src/payment-channel
go run main.go init alice
go run main.go init bob

# 3. Fund Bob's wallet from miner
cd ../..
tmux send-keys -t bitcoin-chain-execute:bash.2 "./commands/fund-wallet.sh" C-m

# 4. Go back to payment-channel
cd src/payment-channel


# 6. Generate 2-of-2 multisig address (redeemScript and address printed)
go run main.go multisig

# 7. Fund the multisig address (off-chain tx signed by Bob)
go run main.go fund-offchain 10

# 8. Decode the funding transaction to extract `txid` and `vout`
bitcoin-cli decoderawtransaction <signed_funding_tx>
go run main.go set-htlc-tx 9ff1910c7d857a7e887ffc3f87b53f6a388c678d2e573ae929e54dfdcec0f320 0

# 9. Update data/state.json with:


# 10. Broadcast the funding transaction
bitcoin-cli sendrawtransaction <signed_funding_tx>

# 11. Create commitment transaction (off-chain execution #1)
#Commit 1
go run main.go commit <amount_alice> <amount_bob> # Alice create commit transaction with balance in OP_RETURN
go run main.go sign-alice # Alice sign the transaction -> Send to Bob
go run main.go verify # Bob verify transaction to read the information
go run main.go sign-bob yes # If Bob agrees -> Sign the transaction

#Commit next
...

# 13. Broadcast the commitment tx (simulate settlement)
go run main.go settle
bitcoin-cli generate 1

```

