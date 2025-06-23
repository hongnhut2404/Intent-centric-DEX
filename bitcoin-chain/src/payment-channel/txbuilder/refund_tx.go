package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type UTXOInfo struct {
	TxID         string  `json:"txid"`
	Vout         uint32  `json:"vout"`
	Amount       float64 `json:"amount"`
	RedeemScript string  `json:"redeemScript"`
}

func RefundTransaction(statePath string) error {
	// Load state
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state file: %v", err)
	}

	var state State
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("failed to parse state file: %v", err)
	}

	amountSatoshi := int64(state.HTLC.Amount * 1e8)
	redeemScriptBytes, err := hex.DecodeString(state.HTLC.RedeemScript)
	if err != nil {
		return fmt.Errorf("invalid redeem script: %v", err)
	}

	// Prepare tx input
	tx := wire.NewMsgTx(wire.TxVersion)
	tx.LockTime = 1700000000 // Example: Replace with your actual timelock

	txHash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid txid: %v", err)
	}
	outpoint := wire.NewOutPoint(txHash, state.HTLC.Vout)
	txIn := wire.NewTxIn(outpoint, nil, nil)
	txIn.Sequence = 0 // Required for timelock to activate
	tx.AddTxIn(txIn)

	// Build output to Bob
	bobAddr, err := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Bob address: %v", err)
	}
	pkScript, err := txscript.PayToAddrScript(bobAddr)
	if err != nil {
		return fmt.Errorf("output script error: %v", err)
	}

	fee := int64(500)
	txOut := wire.NewTxOut(amountSatoshi-fee, pkScript)
	tx.AddTxOut(txOut)

	// Sign with Bob's private key
	privKeyBytes, err := hex.DecodeString(state.Bob.PrivKey)
	if err != nil {
		return fmt.Errorf("invalid Bob privkey: %v", err)
	}
	privKey, _ := btcec.PrivKeyFromBytes(privKeyBytes)

	sigScript, err := txscript.SignatureScript(
		tx, 0, redeemScriptBytes, txscript.SigHashAll, privKey, true)
	if err != nil {
		return fmt.Errorf("failed to create sig script: %v", err)
	}

	// Complete the scriptSig (refund path): <sig> <pubkey> <0> <redeemScript>
	txIn.SignatureScript = append(sigScript, redeemScriptBytes...)

	// Serialize tx
	var buf bytes.Buffer
	tx.Serialize(&buf)
	txHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Refund raw tx (hex):", txHex)
	return os.WriteFile("data/refund-tx.txt", []byte(txHex), 0644)
}
