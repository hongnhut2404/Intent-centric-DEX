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
	fee := int64(500)

	tx := wire.NewMsgTx(wire.TxVersion)

	hash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid txid: %v", err)
	}
	txIn := wire.NewTxIn(wire.NewOutPoint(hash, state.HTLC.Vout), nil, nil)
	tx.AddTxIn(txIn)

	addr, err := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Alice address: %v", err)
	}
	pkScript, err := txscript.PayToAddrScript(addr)
	if err != nil {
		return fmt.Errorf("failed to create output script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(amountSatoshi-fee, pkScript))

	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return fmt.Errorf("serialize error: %v", err)
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Unsigned Commitment Transaction (hex):", rawTxHex)
	return os.WriteFile("data/commit-unsigned.txt", []byte(rawTxHex), 0644)
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

	totalAmount := int64(state.HTLC.Amount * 1e8)
	bobAmountSat := int64(bobAmount * 1e8)
	fee := int64(500)

	if bobAmountSat+fee > totalAmount {
		return fmt.Errorf("invalid amount: bobAmount + fee exceeds total")
	}
	aliceAmountSat := totalAmount - bobAmountSat - fee

	tx := wire.NewMsgTx(wire.TxVersion)

	hash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid txid: %v", err)
	}
	txIn := wire.NewTxIn(wire.NewOutPoint(hash, state.HTLC.Vout), nil, nil)
	tx.AddTxIn(txIn)

	bobAddr, err := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Bob address: %v", err)
	}
	bobScript, err := txscript.PayToAddrScript(bobAddr)
	if err != nil {
		return fmt.Errorf("cannot create Bob script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(bobAmountSat, bobScript))

	aliceAddr, err := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid Alice address: %v", err)
	}
	aliceScript, err := txscript.PayToAddrScript(aliceAddr)
	if err != nil {
		return fmt.Errorf("cannot create Alice script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(aliceAmountSat, aliceScript))

	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return fmt.Errorf("serialize error: %v", err)
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Unsigned Commitment Transaction (hex):", rawTxHex)
	return os.WriteFile("data/commit-unsigned.txt", []byte(rawTxHex), 0644)
}
