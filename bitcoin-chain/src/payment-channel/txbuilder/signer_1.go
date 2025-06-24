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

func SignCommitmentTx1(statePath string) error {
	// Load state
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state file: %v", err)
	}

	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state file: %v", err)
	}

	// Load unsigned tx from file
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

	// Prepare redeem script
	redeemScript, err := hex.DecodeString(state.HTLC.RedeemScript)
	if err != nil {
		return fmt.Errorf("invalid redeem script: %v", err)
	}

	// Decode private keys
	alicePrivKeyBytes, _ := hex.DecodeString(state.Alice.PrivKey)
	alicePrivKey, _ := btcec.PrivKeyFromBytes(alicePrivKeyBytes)

	bobPrivKeyBytes, _ := hex.DecodeString(state.Bob.PrivKey)
	bobPrivKey, _ := btcec.PrivKeyFromBytes(bobPrivKeyBytes)

	// Compute sighash for input 0
	sighash, err := txscript.CalcSignatureHash(redeemScript, txscript.SigHashAll, tx, 0)
	if err != nil {
		return fmt.Errorf("failed to calculate sighash: %v", err)
	}

	// Sign by both parties
	aliceSig := ecdsa.Sign(alicePrivKey, sighash)
	bobSig := ecdsa.Sign(bobPrivKey, sighash)
	aliceSigBytes := append(aliceSig.Serialize(), byte(txscript.SigHashAll))
	bobSigBytes := append(bobSig.Serialize(), byte(txscript.SigHashAll))

	// Build multisig scriptSig
	scriptSig, err := txscript.NewScriptBuilder().
		AddOp(txscript.OP_0).
		AddData(aliceSigBytes).
		AddData(bobSigBytes).
		AddData(redeemScript).
		Script()
	if err != nil {
		return fmt.Errorf("failed to build scriptSig: %v", err)
	}
	tx.TxIn[0].SignatureScript = scriptSig

	// Serialize final signed tx
	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Signed Commitment Tx:", finalHex)
	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}
