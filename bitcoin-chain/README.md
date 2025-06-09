# Cross-chain Atomic Swap: Ethereum (Hardhat) ↔ Bitcoin Core (RegTest)

## Step 0.1: Setup Localhost for Ethereum Hardhat
```bash
npx hardhat node
```

## Step 1: Deploy HTLC on Ethereum
Alice deploys the HTLC contract and retrieves the address.

```bash
npx hardhat run scripts/deployHTLC.js --network localhost
# Output: HTLC contract address
```

## Step 2: Create HTLC on Ethereum
Alice creates the HTLC on-chain.

```bash
npx hardhat run scripts/createHTLC.js --network localhost
# Input: htlcAddress, recipient address, timelock
# Output: secret (preimage), hash(secret) (sha256)
```

---

## Step 0.2: Setup Localhost for Bitcoin Core
```bash
mux start bitcoin-regtest
tmux send-keys -t bitcoin-regtest:bash.2 "./commands/fund-wallet.sh" C-m
```

## Step 3: Bob Receives the Hash and create HTLC 
Alice sends the `sha256(secret)` to Bob (via payment channel or off-chain).
Bob uses the hash to generate the corresponding HTLC on Bitcoin.
```bash
cd src/create-HTLC-contract
go build
./m
```

## Step 4: Create Raw BTC Transaction to fund HTLC
Send BTC from the miner address to Bob.

```bash
cd src/create-raw-transaction
go build
./m
# Input: txid (from scantxout), vout, sender address, recipient address
# Output: raw txid
```

## Step 5: Sign the BTC Raw Transaction to fund HTLC
```bash
cd src/sign-raw-transaction-with-key
go build
./m
# Input: txid, vout, scriptPubKey, amount (from scantxout), redeem script, raw txid, sender private key
# Output: signed raw txid
```

## Step 6: Broadcast the Signed BTC Transaction
```bash
bitcoin-cli sendrawtransaction <signed_raw_txid>
# Output: broadcasted txid
bitcoin-cli scantxoutset start "[\"addr(<address_htlc>)\"]" 
# Store in address-test

```

## Step 7: Alice Claims BTC Using Secret
```bash
cd src/sign-redeem-transaction
go build
./m
# Input: txid, vout, recipient address, amount -> create raw transaction
# Then input: raw txid, secret (preimage), redeem script, recipient private key, recipient public key
# Output: signed redeem txid
```

```bash
bitcoin-cli sendrawtransaction <signed_redeem_txid>
```

---

## Step 8: Alice Reveals the Secret
Once Alice redeems BTC, the `secret` becomes public on the blockchain.

---

## Step 9: Bob Uses Secret to Claim ETH
Bob uses the revealed secret to claim ETH from the HTLC contract on Ethereum.

```bash
npx hardhat run scripts/withdrawHTLC.js --network localhost
# Update withdrawHTLC.js script
# Input: lockID, secret (preimage), htlcAddress, recipient address
```

---

> ✅ Atomic swap is complete: BTC to Alice, ETH to Bob

## Note
- The locktime needs to be implemted in code of create-HTLC-contract
- The amount of funds locked in HTLC needs to be input in code
- Functions are still repeated in code (need to be implemented in module)
- Refund function is still in hardcode