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

type State struct {
	Alice struct {
		PrivKey string `json:"privkey"`
		PubKey  string `json:"pubkey"`
		Address string `json:"address"`
	} `json:"alice"`

	Bob struct {
		PrivKey string `json:"privkey"`
		PubKey  string `json:"pubkey"`
		Address string `json:"address"`
	} `json:"bob"`

	HTLC struct {
		Txid         string  `json:"txid"`
		Vout         uint32  `json:"vout"`
		Amount       float64 `json:"amount"`
		RedeemScript string  `json:"redeemScript"`
	} `json:"htlc"`
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
