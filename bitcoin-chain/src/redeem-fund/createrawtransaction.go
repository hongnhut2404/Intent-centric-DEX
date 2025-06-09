package main

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
)

type TxInput struct {
	TxID         string   `json:"txid"`
	Vout         uint32   `json:"vout"`
	ScriptPubKey string   `json:"scriptPubKey"` // UTXO's locking script
	RedeemScript string   `json:"redeemScript"` // HTLC redeem script
	Amount       float64  `json:"amount"`       // UTXO amount
	WitnessData  []string `json:"witnessData"`  // Will contain signature, preimage, etc.
}

type TxOutput struct {
	Address string  `json:"address"`
	Amount  float64 `json:"amount"`
}

func CreateRawTransaction(inputs []TxInput, outputs []TxOutput, locktime uint32) (string, error) {
	if len(inputs) == 0 || len(outputs) == 0 {
		return "", fmt.Errorf("must have at least one input and one output")
	}

	var rawTx strings.Builder

	// Version
	rawTx.WriteString("02000000")

	// Marker & Flag for SegWit
	rawTx.WriteString("0001")

	// Input count
	rawTx.WriteString("01")

	// Reverse TXID
	rawTx.WriteString(reverseHex(inputs[0].TxID))

	// Vout
	rawTx.WriteString(fmt.Sprintf("%08x", inputs[0].Vout))

	// scriptSig: push redeemScript hash for P2SH (hash160 of redeemScript)
	redeemScriptBytes, err := hex.DecodeString(inputs[0].RedeemScript)
	if err != nil {
		return "", fmt.Errorf("invalid redeemScript: %v", err)
	}
	redeemScriptHash := btcutil.Hash160(redeemScriptBytes) // import "github.com/btcsuite/btcutil"
	rawTx.WriteString(fmt.Sprintf("19a914%s87", hex.EncodeToString(redeemScriptHash)))

	// Sequence
	rawTx.WriteString("ffffffff")

	// Output count
	rawTx.WriteString("01")

	// Output amount (little-endian)
	amountSatoshi := uint64(outputs[0].Amount * 100000000)
	amountBytes := make([]byte, 8)
	for i := range amountBytes {
		amountBytes[i] = byte(amountSatoshi >> uint(8*i))
	}
	rawTx.WriteString(hex.EncodeToString(amountBytes))

	// Output script
	address, err := btcutil.DecodeAddress(outputs[0].Address, &chaincfg.RegressionNetParams) // Use RegNetParams
	if err != nil {
		return "", fmt.Errorf("failed to decode output address: %v", err)
	}
	pkScript, err := txscript.PayToAddrScript(address)
	if err != nil {
		return "", fmt.Errorf("failed to create output script: %v", err)
	}
	rawTx.WriteString(fmt.Sprintf("%02x", len(pkScript))) // Add script length
	rawTx.WriteString(hex.EncodeToString(pkScript))

	// Witness data section
	if len(inputs[0].WitnessData) == 0 {
		return "", fmt.Errorf("witness data required")
	}

	var witness strings.Builder
	// Number of witness items
	witness.WriteString(fmt.Sprintf("%02x", len(inputs[0].WitnessData)))

	for _, item := range inputs[0].WitnessData {
		if item == "" {
			witness.WriteString("00")
		} else {
			data, err := hex.DecodeString(item)
			if err != nil {
				return "", fmt.Errorf("invalid hex in witness: %v", err)
			}
			witness.WriteString(fmt.Sprintf("%02x", len(data)))
			witness.WriteString(hex.EncodeToString(data))
		}
	}

	// Append witness to tx
	rawTx.WriteString(witness.String())

	// Locktime
	rawTx.WriteString(fmt.Sprintf("%08x", locktime))

	return rawTx.String(), nil
}

func reverseHex(hexStr string) string {
	b, err := hex.DecodeString(hexStr)
	if err != nil {
		panic(err)
	}
	for i := len(b)/2 - 1; i >= 0; i-- {
		opp := len(b) - 1 - i
		b[i], b[opp] = b[opp], b[i]
	}
	return hex.EncodeToString(b)
}

// func SignRawTransactionWithKey(unsignedTx string, inputIndex int, redeemScript string, privateKey *ecdsa.PrivateKey, utxoAmount int64) (string, error) {
// 	txBytes, err := hex.DecodeString(unsignedTx)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to decode raw transaction: %v", err)
// 	}

// 	msg, err := txscript.NewMsgTxFromBytes(txBytes)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to parse raw transaction: %v", err)
// 	}

// 	source := &txscript.PrevOutput{
// 		TxOut: &btcutil.TxOut{
// 			Value:    utxoAmount,
// 			PkScript: nil, // ScriptPubKey is not directly used for signing P2SH-P2WSH
// 		},
// 	}

// 	sigScript, err := txscript.RawTxInWitnessSignature(msg, source, inputIndex, utxoAmount, hexToScript(redeemScript), txscript.SigHashAll, privateKey)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to generate witness signature: %v", err)
// 	}

// 	// Extract the signature and push it to the witness stack
// 	witness := make([][]byte, 2)
// 	witness[0] = sigScript
// 	redeemScriptBytes, err := hex.DecodeString(redeemScript)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to decode redeem script: %v", err)
// 	}
// 	witness[1] = redeemScriptBytes

// 	msg.TxIn[inputIndex].Witness = witness

// 	// Re-serialize the transaction with the witness data
// 	signedTxBytes, err := msg.Bytes()
// 	if err != nil {
// 		return "", fmt.Errorf("failed to serialize signed transaction: %v", err)
// 	}

// 	return hex.EncodeToString(signedTxBytes), nil
// }

// func hexToScript(hexStr string) ([]byte, error) {
// 	script, err := hex.DecodeString(hexStr)
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to decode hex script: %v", err)
// 	}
// 	return script, nil
// }
