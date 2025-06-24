package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type SignState struct {
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

func SignCommitmentTx(statePath string) error {
	// Load state
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state file: %v", err)
	}

	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state file: %v", err)
	}

	// Load unsigned tx
	txHex, err := os.ReadFile("data/commit-unsigned.txt")
	if err != nil {
		return fmt.Errorf("failed to read raw commitment tx: %v", err)
	}

	rawTxBytes, err := hex.DecodeString(string(txHex))
	if err != nil {
		return fmt.Errorf("invalid raw tx hex: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	if err := tx.Deserialize(bytes.NewReader(rawTxBytes)); err != nil {
		return fmt.Errorf("failed to parse tx: %v", err)
	}

	redeemScript, err := hex.DecodeString(state.HTLC.RedeemScript)
	if err != nil {
		return fmt.Errorf("invalid redeem script: %v", err)
	}

	alicePrivKeyBytes, _ := hex.DecodeString(state.Alice.PrivKey)
	alicePrivKey, _ := btcec.PrivKeyFromBytes(alicePrivKeyBytes)

	bobPrivKeyBytes, _ := hex.DecodeString(state.Bob.PrivKey)
	bobPrivKey, _ := btcec.PrivKeyFromBytes(bobPrivKeyBytes)

	amount := int64(state.HTLC.Amount * 1e8)

	txOut := &wire.TxOut{
		PkScript: redeemScript,
		Value:    amount,
	}

	// Create canned prev output fetcher from OutPoint
	prevOutputs := map[wire.OutPoint]*wire.TxOut{
		tx.TxIn[0].PreviousOutPoint: txOut,
	}
	prevFetcher := txscript.NewMultiPrevOutFetcher(prevOutputs)

	hashCache := txscript.NewTxSigHashes(tx, prevFetcher)

	sighash1, err := txscript.CalcWitnessSigHash(
		redeemScript, hashCache, txscript.SigHashAll, tx, 0, amount,
	)
	if err != nil {
		return fmt.Errorf("failed sighash1: %v", err)
	}
	aliceSig := ecdsa.Sign(alicePrivKey, sighash1)
	aliceSigBytes := append(aliceSig.Serialize(), byte(txscript.SigHashAll))

	sighash2, err := txscript.CalcWitnessSigHash(
		redeemScript, hashCache, txscript.SigHashAll, tx, 0, amount,
	)
	if err != nil {
		return fmt.Errorf("failed sighash2: %v", err)
	}
	bobSig := ecdsa.Sign(bobPrivKey, sighash2)
	bobSigBytes := append(bobSig.Serialize(), byte(txscript.SigHashAll))

	tx.TxIn[0].SignatureScript = nil
	tx.TxIn[0].Witness = wire.TxWitness{
		{},            // Dummy for multisig OP_0
		aliceSigBytes, // Signature 1
		bobSigBytes,   // Signature 2
		redeemScript,  // Redeem script (2-of-2)
	}

	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("\n✅ Signed SegWit Commitment Tx:")
	fmt.Println(finalHex)

	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}
