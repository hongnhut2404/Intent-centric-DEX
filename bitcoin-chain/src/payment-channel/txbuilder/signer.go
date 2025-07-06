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

func decodeHex(s string) []byte {
	b, _ := hex.DecodeString(s)
	return b
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

	// Decode redeem script
	redeemScript, err := hex.DecodeString(state.HTLC.RedeemScript)
	if err != nil {
		return fmt.Errorf("invalid redeem script: %v", err)
	}

	// Decode private keys
	alicePrivKeyBytes, _ := hex.DecodeString(state.Alice.PrivKey)
	alicePrivKey, _ := btcec.PrivKeyFromBytes(alicePrivKeyBytes)

	bobPrivKeyBytes, _ := hex.DecodeString(state.Bob.PrivKey)
	bobPrivKey, _ := btcec.PrivKeyFromBytes(bobPrivKeyBytes)

	// ---- SIGNING ----

	// Clear scriptSig before signing (very important!)
	tx.TxIn[0].SignatureScript = nil

	// Compute sighash for legacy P2SH input
	sighash, err := txscript.CalcSignatureHash(redeemScript, txscript.SigHashAll, tx, 0)
	if err != nil {
		return fmt.Errorf("failed to calculate sighash: %v", err)
	}

	fmt.Printf("Sighash (preimage): %x\n", sighash)

	// Sign with Alice and Bob
	aliceSig := ecdsa.Sign(alicePrivKey, sighash)
	aliceSigBytes := append(aliceSig.Serialize(), byte(txscript.SigHashAll))

	bobSig := ecdsa.Sign(bobPrivKey, sighash)
	bobSigBytes := append(bobSig.Serialize(), byte(txscript.SigHashAll))

	// Build final scriptSig
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

	// Serialize final tx
	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Signed Commitment Tx:", finalHex)
	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}

func SignCommitmentTxAlice(statePath string) error {
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state file: %v", err)
	}
	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state: %v", err)
	}

	// load unsigned tx
	txHex, err := os.ReadFile("data/commit-unsigned.txt")
	if err != nil {
		return fmt.Errorf("failed to read unsigned tx: %v", err)
	}
	rawTxBytes, err := hex.DecodeString(string(txHex))
	if err != nil {
		return fmt.Errorf("invalid raw tx: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	if err := tx.Deserialize(bytes.NewReader(rawTxBytes)); err != nil {
		return fmt.Errorf("cannot parse tx: %v", err)
	}

	// decode redeem
	redeemScript, _ := hex.DecodeString(state.HTLC.RedeemScript)

	// sighash
	sighash, _ := txscript.CalcSignatureHash(redeemScript, txscript.SigHashAll, tx, 0)

	// alice sign
	alicePriv, _ := btcec.PrivKeyFromBytes(decodeHex(state.Alice.PrivKey))
	aliceSig := ecdsa.Sign(alicePriv, sighash)
	aliceSigBytes := append(aliceSig.Serialize(), byte(txscript.SigHashAll))

	// add OP_RETURN with Alice's signature
	opReturnScript, err := txscript.NullDataScript(aliceSigBytes)
	if err != nil {
		return fmt.Errorf("failed to build OP_RETURN: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(0, opReturnScript))

	// serialize
	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return fmt.Errorf("serialization failed: %v", err)
	}

	finalHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Alice signed transaction with OP_RETURN signature attached:")
	fmt.Println(finalHex)

	// store for Bob to read
	return os.WriteFile("data/commit-alice-signed.txt", []byte(finalHex), 0644)
}

func SignCommitmentTxBob(statePath string) error {
	// Load state
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state: %v", err)
	}

	// Load Alice-signed transaction with her signature in OP_RETURN
	txHex, err := os.ReadFile("data/commit-alice-signed.txt")
	if err != nil {
		return fmt.Errorf("missing Alice-signed tx: %v", err)
	}
	rawTxBytes, err := hex.DecodeString(string(txHex))
	if err != nil {
		return fmt.Errorf("invalid tx hex: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	if err := tx.Deserialize(bytes.NewReader(rawTxBytes)); err != nil {
		return fmt.Errorf("cannot parse tx: %v", err)
	}

	// find Alice signature in OP_RETURN
	var aliceSigBytes []byte
	found := false
	for _, out := range tx.TxOut {
		if txscript.GetScriptClass(out.PkScript) == txscript.NullDataTy {
			asm, err := txscript.DisasmString(out.PkScript)
			if err == nil && len(asm) > 0 {
				// parse pushdata
				parsed, _ := txscript.PushedData(out.PkScript)
				if len(parsed) > 0 {
					aliceSigBytes = parsed[0]
					found = true
					break
				}
			}
		}
	}
	if !found {
		return fmt.Errorf("alice's signature not found in OP_RETURN")
	}

	// Decode redeem script
	redeemScript, _ := hex.DecodeString(state.HTLC.RedeemScript)

	// sighash
	sighash, _ := txscript.CalcSignatureHash(redeemScript, txscript.SigHashAll, tx, 0)

	// verify Alice signature
	alicePubBytes, _ := hex.DecodeString(state.Alice.PubKey)
	alicePub, _ := btcec.ParsePubKey(alicePubBytes)
	aliceSigParsed, err := ecdsa.ParseDERSignature(aliceSigBytes[:len(aliceSigBytes)-1])
	if err != nil {
		return fmt.Errorf("failed to parse Alice's signature: %v", err)
	}
	if !aliceSigParsed.Verify(sighash, alicePub) {
		return fmt.Errorf("Alice's signature is invalid")
	}
	fmt.Println("Alice's signature verified from OP_RETURN")

	// Bob signs
	bobPriv, _ := btcec.PrivKeyFromBytes(decodeHex(state.Bob.PrivKey))
	bobSig := ecdsa.Sign(bobPriv, sighash)
	bobSigBytes := append(bobSig.Serialize(), byte(txscript.SigHashAll))

	// build final scriptSig
	scriptSig, err := txscript.NewScriptBuilder().
		AddOp(txscript.OP_0).
		AddData(aliceSigBytes).
		AddData(bobSigBytes).
		AddData(redeemScript).
		Script()
	if err != nil {
		return fmt.Errorf("building scriptSig failed: %v", err)
	}
	tx.TxIn[0].SignatureScript = scriptSig

	// remove the OP_RETURN output because no longer needed
	var newOutputs []*wire.TxOut
	for _, out := range tx.TxOut {
		if txscript.GetScriptClass(out.PkScript) != txscript.NullDataTy {
			newOutputs = append(newOutputs, out)
		}
	}
	tx.TxOut = newOutputs

	// serialize
	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Bob finalized signed tx:", finalHex)
	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}
