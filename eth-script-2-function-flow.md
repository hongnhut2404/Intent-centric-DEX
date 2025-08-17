# ETH-Script-2 Function Call Flow Diagram

## Overview
This diagram shows the real function calls executed by `eth-script-2.txt` in the Intent-centric DEX system.

---

### 1. Reveal the Secret On-Chain
```
# This step broadcasts the secret via the revealSecret() function in the HTLC contract
npx hardhat run localhost-script/htlc/revealSecret.js --network localhost
    -> revealSecret.js:
        - Loads HTLC contract
        - Calls htlc.revealSecret(lockId, secret)
        - Emits SecretRevealed event
```

---

### 2. Claim the Fund Using Revealed Secret
```
# This step listens for SecretRevealed event and uses it to withdraw via multisig
npx hardhat run localhost-script/htlc/withdrawHTLC.js --network localhost
    -> withdrawHTLC.js:
        - Loads IntentMatching and HTLC contracts
        - Finds associated HTLCs for BuyIntent
        - For each lockId:
            - Fetches revealed secret from SecretRevealed event
            - Prepares calldata for htlc.withdraw(lockId, secret)
            - multisig.submitTransaction(htlcAddress, 0, calldata)
            - multisig.confirmTransaction(txID) × required
            - multisig.executeTransaction(txID)
        - ETH transferred to recipient
```

---

### 3. Process Complete
```
# No function call, just a completion message
```

---

## Summary Table

| Step                  | Real Function Called (JS/Contract)                |
|-----------------------|---------------------------------------------------|
| Reveal Secret         | `htlc.revealSecret(lockId, secret)`               |
| Claim Fund            | `htlc.withdraw(lockId, secret)` via multisig      |
| Multisig Ops          | `submitTransaction()`, `confirmTransaction()`, `executeTransaction()` |
| Process Complete      | (user action)                                     |

---

This flow shows the actual contract function calls and multisig operations executed at each step in your eth-script-2.txt workflow.
