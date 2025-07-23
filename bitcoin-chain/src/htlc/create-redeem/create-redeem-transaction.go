package main

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type InputRawRedeemTransaction struct {
	prevTxHash      string
	prevOutputIndex uint32
	outputAddr      string
	outputAmount    float64
}

// Helper function to decode and reverse a txid hex string
func decodeAndReverseTxid(txidHex string) ([]byte, error) {
	txidBytes, err := hex.DecodeString(txidHex)
	if err != nil {
		return nil, err
	}
	reversed := make([]byte, len(txidBytes))
	for i := 0; i < len(txidBytes); i++ {
		reversed[i] = txidBytes[len(txidBytes)-1-i]
	}
	return reversed, nil
}

// createRawTransaction creates a raw transaction with input and output
func createRawTransaction(input InputRawRedeemTransaction, netParams *chaincfg.Params) (*wire.MsgTx, error) {
	tx := wire.NewMsgTx(wire.TxVersion)

	reversedTxid, err := decodeAndReverseTxid(input.prevTxHash)
	if err != nil {
		return nil, fmt.Errorf("error generate reversed transaction: %v", err)
	}

	// Add input
	txHash, err := chainhash.NewHash(reversedTxid)
	if err != nil {
		return nil, fmt.Errorf("error creating hash: %v", err)
	}
	prevOut := wire.NewOutPoint(txHash, input.prevOutputIndex)
	txIn := wire.NewTxIn(prevOut, nil, nil)
	txIn.Sequence = 0xffffffff // Final sequence for immediate finality
	tx.AddTxIn(txIn)

	// Add output (P2WPKH)
	addr, err := btcutil.DecodeAddress(input.outputAddr, netParams)
	if err != nil {
		return nil, fmt.Errorf("error decoding output address: %v", err)
	}
	outputScript, err := txscript.PayToAddrScript(addr)
	if err != nil {
		return nil, fmt.Errorf("error creating output script: %v", err)
	}
	txOut := wire.NewTxOut(int64(input.outputAmount*100000000), outputScript)
	tx.AddTxOut(txOut)

	// Set locktime to 0 for immediate finality
	tx.LockTime = 0

	// Serialize to hex
	var buf bytes.Buffer
	err = tx.Serialize(&buf)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize transaction: %v", err)
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Raw redeem transaction (hex):", rawTxHex)

	return tx, nil
}
