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
npx hardhat run localhost-script/matching-intent/deployMultisigWallet.js --network localhost
```
After deploying, the address of contract will be stored in my-solidity-project/data/intent-matching-address.json

## Step 3. Create Intents
Note:
- Input of BuyIntents and SellIntents is currently implemented in hard code
```bash
npx hardhat run localhost-script/matching-intent/createBuyIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/createSellIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/confirmSellIntent.js --network localhost
npx hardhat run localhost-script/matching-intent/viewAllIntents.js --network localhost
```

## Step 4. Run Intent Matching
```bash
BUY_ID=0 npx hardhat run localhost-script/matching-intent/matchingIntentComponent.js --network localhost
TX_ID=3 npx hardhat run localhost-script/matching-intent/confirmMultisigTx.js --network localhost

```

## Step 5. Deploy HTLC Contract
Alice deploys the HTLC contract and retrieves the address.

```bash
npx hardhat run localhost-script/htlc/deployHTLC.js --network localhost
npx hardhat run localhost-script/htlc/fund.js --network localhost
# Output: HTLC contract address
```

## Step 6. Create HTLC (ETH Lock by Alice)
Alice creates the HTLC on-chain.

```bash
npx hardhat run localhost-script/htlc/createHTLC.js --network localhost
npx hardhat run localhost-script/htlc/viewHTLC.js --network localhost
# BUY_ID=0 npx hardhat run localhost-script/htlc/withdrawHTLC.js --network localhost
# npx hardhat run localhost-script/htlc/refundHTLC.js --network localhost
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
go run main.go generate-message <secret> <amount>
```


## Step 11: Verify OP_RETURN and Extract Info
```bash
go run main.go verify-opreturn ../../data-script/payment_message.json ../../data-script/payment_opreturn.txt
```

## Step 12: Create HTLC Based on OP_RETURN Info
```bash
cd ../htlc/create-htlc
go run *.go
```

## Step 13: Fund the HTLC in One Step
```bash
cd ../fund
go run *.go
```

## Step 14: Scan HTLC Address to Save as UTXO
```bash
cd ../scan-htlc
go run *.go

```

## Step 15: Create Redeem Transaction (Alice Redeems BTC)
```bash
cd ../create-redeem
go run *.go
```

## Step 16: Sign Redeem Transaction
```bash
cd ../sign-redeem
go run *.go <secret>
```

## Step 17: Broadcast Redeem Transaction
```bash
bitcoin-cli sendrawtransaction <signed_redeem_tx>

```

## Step 18: Generate 1 Block to Confirm
```bash
bitcoin-cli generate 1
```

## Step 19: Alice Reveals the Secret
Once Alice redeems BTC, the `secret` becomes public on the blockchain.

---

## Step 20: Bob Uses Secret to Claim ETH
Bob uses the revealed secret to claim ETH from the HTLC contract on Ethereum.

```bash
BUY_ID=0 npx hardhat run scripts/htlc/withdrawHTLC.js --network localhost
# Update withdrawHTLC.js script
# Input: lockID, secret (preimage), htlcAddress, recipient address
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

tạo payment channel
solver gửi cho user thông tin thông qua op_return của transaction (off-chain)
user dùng thông tin đó để tạo ra htlc
solver dùng preimage secret để unlock cái htlc
