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


## Step 0.1: Setup Localhost for Ethereum Hardhat
```bash
npx hardhat node
```

## Step 1: Deploy IntentMatching contract
```bash
npx hardhat run localhost-script/matching-intent/deployIntentMatching.js --network localhost
```
After deploying, the address of contract will be stored in my-solidity-project/data/intent-matching-address.json

## Step 2: Create the list of BuyIntents and SellIntents
Note:
- Input of BuyIntents and SellIntents is currently implemented in hard code
```bash
npx hardhat run localhost-script/matching-intent/createBuyIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/createSellIntent.js --network localhost
```

## Step 3: Execute Intent Matching process
Note:
- Currently, the matchingIntent algorithm still occurs many errors
```bash
npx hardhat run localhost-script/matching-intent/matchingIntentComponent.js --network localhost
```

## Step 4: Deploy HTLC on Ethereum
Alice deploys the HTLC contract and retrieves the address.

```bash
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
# Output: HTLC contract address
```

## Step 5: Create HTLC on Ethereum
Alice creates the HTLC on-chain.

```bash
npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
# Input: htlcAddress, recipient address, timelock
# Output: secret (preimage), hash(secret) (sha256)
```

---

## Step 0.2: Setup Localhost for Bitcoin Core
```bash
cd bitcoin-chain
mux start -p ../.tmuxinator/bitcoin-chain-execute.yml
tmux send-keys -t bitcoin-chain-execute:bash.2 "./commands/fund-wallet.sh" C-m
# Make sure you are in ~/Intent-centric-DEX/bitcoin-chain
```

## Step 6: Bob Receives the Hash and create HTLC 
Alice sends the `sha256(secret)` to Bob.
Bob uses the hash to generate the corresponding HTLC on Bitcoin.
```bash
go run ./src/create-HTLC-contract/*.go
```

## Step 7: Create Raw BTC Transaction to fund HTLC
Send BTC from the miner address to Bob.

```bash
go run ./src/create-raw-transaction/*.go
# Input: txid (from scantxout), vout, sender address, recipient address
# Output: raw txid
```

## Step 8: Sign the BTC Raw Transaction to fund HTLC
```bash
go run ./src/sign-raw-transaction-with-key/*.go
# Input: txid, vout, scriptPubKey, amount (from scantxout), redeem script, raw txid, sender private key
# Output: signed raw txid
```

## Step 9: Broadcast the Signed BTC Transaction
```bash
bitcoin-cli sendrawtransaction <signed_raw_txid>
# Output: broadcasted txid
bitcoin-cli scantxoutset start "[\"addr(<address_htlc>)\"]" > ./data-script/utxo-htlc.json
# Store in utxo-htlc.json

```

## Step 10: Alice Claims BTC Using Secret
```bash
go run ./src/create-redeem-transaction/*.go
go run ./src/sign-redeem-transaction/*.go
# Input: txid, vout, recipient address, amount -> create raw transaction
# Then input: raw txid, secret (preimage), redeem script, recipient private key, recipient public key
# Output: signed redeem txid
```

```bash
bitcoin-cli sendrawtransaction <signed_redeem_txid>
```

---

## Step 11: Alice Reveals the Secret
Once Alice redeems BTC, the `secret` becomes public on the blockchain.

---

## Step 12: Bob Uses Secret to Claim ETH
Bob uses the revealed secret to claim ETH from the HTLC contract on Ethereum.

```bash
npx hardhat run localhost-script/htlc/withdrawHTLC.js --network localhost
# Update withdrawHTLC.js script
# Input: lockID, secret (preimage), htlcAddress, recipient address
```

## Step 13: To stop Bitcoin chain
```bash
mux stop -p ../.tmuxinator/bitcoin-chain-execute.yml
tmux kill-session
```

---

> ✅ Atomic swap is complete: BTC to Alice, ETH to Bob

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
