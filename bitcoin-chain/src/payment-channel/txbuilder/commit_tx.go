package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type KeyInfo struct {
	PrivKey string `json:"privkey"`
	PubKey  string `json:"pubkey"`
	Address string `json:"address"`
}

type HTLC struct {
	Txid         string  `json:"txid,omitempty"`
	Vout         uint32  `json:"vout"`
	Amount       float64 `json:"amount,omitempty"`
	RedeemScript string  `json:"redeemScript,omitempty"`
}

type State struct {
	Alice *KeyInfo `json:"alice"`
	Bob   *KeyInfo `json:"bob"`
	HTLC  *HTLC    `json:"htlc,omitempty"`
}

func CreateCommitmentTx(stateFile string) error {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("cannot read state file: %v", err)
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("invalid JSON: %v", err)
	}

	// Convert amounts and addresses
	amountSatoshi := int64(state.HTLC.Amount * 1e8)

	// Create a new transaction
	tx := wire.NewMsgTx(wire.TxVersion)

	// Add input (HTLC UTXO)
	hash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid txid: %v", err)
	}
	outPoint := wire.NewOutPoint(hash, state.HTLC.Vout)
	txIn := wire.NewTxIn(outPoint, nil, nil)
	tx.AddTxIn(txIn)

	// Estimate fee (static for simplicity)
	fee := int64(500) // in satoshis

	// Create output to Alice (P2PKH)
	addr, err := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Alice address: %v", err)
	}
	pkScript, err := txscript.PayToAddrScript(addr)
	if err != nil {
		return fmt.Errorf("failed to create output script: %v", err)
	}
	txOut := wire.NewTxOut(amountSatoshi-fee, pkScript)
	tx.AddTxOut(txOut)

	// Serialize transaction
	var buf bytes.Buffer
	tx.Serialize(&buf)
	rawTxHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Unsigned Commitment Transaction (hex):", rawTxHex)

	// Optionally store to file
	err = os.WriteFile("data/commit-unsigned.txt", []byte(rawTxHex), 0644)
	if err != nil {
		return fmt.Errorf("failed to write raw tx: %v", err)
	}

	return nil
}

func CreateCommitmentTxWithAmount(stateFile string, bobAmount float64) error {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("cannot read state file: %v", err)
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("invalid JSON: %v", err)
	}

	// Basic checks
	totalAmount := int64(state.HTLC.Amount * 1e8)
	bobAmountSat := int64(bobAmount * 1e8)
	fee := int64(500) // fixed fee

	if bobAmountSat+fee > totalAmount {
		return fmt.Errorf("invalid amount: bobAmount + fee exceeds total")
	}
	aliceAmountSat := totalAmount - bobAmountSat - fee

	tx := wire.NewMsgTx(wire.TxVersion)

	// Add input from HTLC
	hash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid txid: %v", err)
	}
	txIn := wire.NewTxIn(wire.NewOutPoint(hash, state.HTLC.Vout), nil, nil)
	tx.AddTxIn(txIn)

	// Output to Bob
	bobAddr, err := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Bob address: %v", err)
	}
	bobScript, err := txscript.PayToAddrScript(bobAddr)
	if err != nil {
		return fmt.Errorf("cannot create Bob script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(bobAmountSat, bobScript))

	// Output to Alice
	aliceAddr, err := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Alice address: %v", err)
	}
	aliceScript, err := txscript.PayToAddrScript(aliceAddr)
	if err != nil {
		return fmt.Errorf("cannot create Alice script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(aliceAmountSat, aliceScript))

	// Serialize tx
	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return fmt.Errorf("failed to serialize tx: %v", err)
	}
	rawTx := hex.EncodeToString(buf.Bytes())

	fmt.Println("Unsigned Commitment Transaction (hex):", rawTx)

	err = os.WriteFile("data/commit-unsigned.txt", []byte(rawTx), 0644)
	if err != nil {
		return fmt.Errorf("failed to write raw tx to file: %v", err)
	}

	return nil
}
