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

	// store Alice’s partial
	err = os.WriteFile("data/alice-sig.txt", []byte(hex.EncodeToString(aliceSigBytes)), 0644)
	if err != nil {
		return fmt.Errorf("failed to store alice sig: %v", err)
	}

	fmt.Println("Alice signature stored in data/alice-sig.txt")
	return nil
}

func SignCommitmentTxBob(statePath string) error {
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state: %v", err)
	}

	// read alice sig
	aliceSigHex, err := os.ReadFile("data/alice-sig.txt")
	if err != nil {
		return fmt.Errorf("missing alice signature: %v", err)
	}
	aliceSigBytes, err := hex.DecodeString(string(aliceSigHex))
	if err != nil {
		return fmt.Errorf("bad alice sig: %v", err)
	}

	// load unsigned tx
	txHex, err := os.ReadFile("data/commit-unsigned.txt")
	if err != nil {
		return fmt.Errorf("missing unsigned tx: %v", err)
	}
	rawTxBytes, _ := hex.DecodeString(string(txHex))
	tx := wire.NewMsgTx(wire.TxVersion)
	tx.Deserialize(bytes.NewReader(rawTxBytes))

	// redeem
	redeemScript, _ := hex.DecodeString(state.HTLC.RedeemScript)

	// sighash
	sighash, _ := txscript.CalcSignatureHash(redeemScript, txscript.SigHashAll, tx, 0)

	// verify alice sig
	alicePubBytes, _ := hex.DecodeString(state.Alice.PubKey)
	alicePub, _ := btcec.ParsePubKey(alicePubBytes)
	aliceSigParsed, err := ecdsa.ParseDERSignature(aliceSigBytes[:len(aliceSigBytes)-1])
	if err != nil {
		return fmt.Errorf("failed to parse Alice signature: %v", err)
	}

	if !aliceSigParsed.Verify(sighash, alicePub) {
		return fmt.Errorf("alice signature invalid")
	}
	fmt.Println("Alice signature verified")

	// bob sign
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
		return fmt.Errorf("script building failed: %v", err)
	}
	tx.TxIn[0].SignatureScript = scriptSig

	// serialize
	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("✅ Bob finalized signed tx:", finalHex)
	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}
