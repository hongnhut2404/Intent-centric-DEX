# BTC-Script Function Call Flow Diagram

## Overview
This diagram shows the real function calls executed by `btc-script.txt` in the Intent-centric DEX system.

---

### 1. Key Initialization
```
go run main.go init alice
    -> main.go: func main() { ... } calls initAlice()
go run main.go init bob
    -> main.go: func main() { ... } calls initBob()
```

---

### 2. Wallet Funding
```
./commands/fund-wallet.sh
    -> bitcoin-cli generatetoaddress 103 <mineraddress>
    -> bitcoin-cli sendtoaddress <bob_address> 100
    -> bitcoin-cli scantxoutset start ["addr(<bob_address>)"]
```

---

### 3. Payment Message & OP_RETURN
```
go run main.go generate-message
    -> main.go: func main() { ... } calls generatePaymentMessage()
go run main.go verify-opreturn ../../data-script/payment_message.json ../../data-script/payment_opreturn.txt
    -> main.go: func main() { ... } calls verifyOpReturn(payment_message.json, payment_opreturn.txt)
```

---

### 4. Bitcoin HTLC Creation & Funding
```
go run *.go   # in create-htlc/
    -> create-htlc/main.go: func main() { ... } calls CreateHTLCContract(senderPub, receiverPub, secretHash, locktime)
go run *.go   # in fund/
    -> fund/main.go: func main() { ... } calls fundHTLC(address, amount)
```

---

### 5. Wait for Mining Confirmation
```
sleep 600
    -> (no function call, just a delay)
```

---

### 6. HTLC UTXO Scan & Redeem Transaction
```
go run *.go   # in scan-htlc/
    -> scan-htlc/main.go: func main() { ... } calls scanHTLCAddress(address)
go run *.go   # in create-redeem/
    -> create-redeem/main.go: func main() { ... } calls createRedeemTransaction(utxo, secret, redeemScript)
go run *.go   # in sign-redeem/
    -> sign-redeem/main.go: func main() { ... } calls signRedeemTransaction(tx, privKey)
```

---

### 7. Manual Broadcast
```
# Workflow completed. You can now broadcast the signed transaction manually.
    -> (no function call, user manually broadcasts)
```

---

## Summary Table

| Step                        | Real Function Called (Go/Shell/Bitcoin RPC)         |
|-----------------------------|-----------------------------------------------------|
| Key Init                    | `initAlice()`, `initBob()`                          |
| Wallet Funding              | `generatetoaddress`, `sendtoaddress`, `scantxoutset`|
| Payment Message             | `generatePaymentMessage()`, `verifyOpReturn()`      |
| HTLC Creation               | `CreateHTLCContract()`, `fundHTLC()`                |
| Wait for Mining             | (sleep)                                             |
| HTLC Scan & Redeem          | `scanHTLCAddress()`, `createRedeemTransaction()`, `signRedeemTransaction()` |
| Manual Broadcast            | (user action)                                       |

---

This flow shows the actual Go functions, shell commands, and Bitcoin RPCs executed at each step in your btc-script.txt workflow.
