package scripts

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type PaymentMessage struct {
	BTCAmount  float64 `json:"btc_amount"`
	SecretHash string  `json:"secret_hash"`
	Signature  string  `json:"signature"`
	PubKey     string  `json:"pubkey"`
}

func loadAliceKeyPair(statePath string) (*btcec.PrivateKey, string, error) {
	file, err := os.ReadFile(statePath)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read state.json: %v", err)
	}

	var state map[string]map[string]string
	if err := json.Unmarshal(file, &state); err != nil {
		return nil, "", fmt.Errorf("invalid JSON format in state.json: %v", err)
	}

	alice, ok := state["alice"]
	if !ok {
		return nil, "", fmt.Errorf("missing 'alice' key in state.json")
	}

	privHex := alice["privkey"]
	pubHex := alice["pubkey"]
	if privHex == "" || pubHex == "" {
		return nil, "", fmt.Errorf("missing privkey or pubkey for alice in state.json")
	}

	privBytes, err := hex.DecodeString(privHex)
	if err != nil {
		return nil, "", fmt.Errorf("invalid hex in alice's privkey: %v", err)
	}
	privKey, _ := btcec.PrivKeyFromBytes(privBytes)

	return privKey, pubHex, nil
}

func GeneratePaymentMessage(secret string, btcAmountStr string, outputPath string, opreturnPath string, statePath string) error {
	btcAmount, err := strconv.ParseFloat(btcAmountStr, 64)
	if err != nil {
		return fmt.Errorf("invalid BTC amount: %v", err)
	}

	privKey, pubKeyHex, err := loadAliceKeyPair(statePath)
	if err != nil {
		return fmt.Errorf("failed to load Alice's key: %v", err)
	}

	secretHashBytes := sha256.Sum256([]byte(secret))
	secretHash := hex.EncodeToString(secretHashBytes[:])

	// Sign message hash
	formattedAmount := fmt.Sprintf("%.8f", btcAmount)
	raw := []byte(formattedAmount + "|" + secretHash)
	digest := sha256.Sum256(raw)
	sig := ecdsa.Sign(privKey, digest[:])

	message := PaymentMessage{
		BTCAmount:  btcAmount,
		SecretHash: secretHash,
		Signature:  hex.EncodeToString(sig.Serialize()),
		PubKey:     pubKeyHex,
	}

	// Ensure output dir
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create output dir: %v", err)
	}

	// Save message JSON
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create message file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(&message); err != nil {
		return fmt.Errorf("failed to encode message JSON: %v", err)
	}

	fmt.Println("Payment message saved to", outputPath)
	fmt.Println("Secret Hash (for Bitcoin HTLC):", secretHash)

	// Build OP_RETURN output
	shortMsg := fmt.Sprintf("%.8f|%s", btcAmount, secretHash)
	shortMsgBytes := []byte(shortMsg)

	if len(shortMsgBytes) > 80 {
		return fmt.Errorf("OP_RETURN message too long: %d bytes", len(shortMsgBytes))
	}

	script, err := txscript.NewScriptBuilder().
		AddOp(txscript.OP_RETURN).
		AddData(shortMsgBytes).
		Script()
	if err != nil {
		return fmt.Errorf("failed to build OP_RETURN script: %v", err)
	}

	tx := &wire.MsgTx{Version: 1}
	tx.AddTxOut(wire.NewTxOut(0, script))

	// Write OP_RETURN tx
	var buf bytes.Buffer
	if err := tx.SerializeNoWitness(&buf); err != nil {
		return fmt.Errorf("failed to serialize tx: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(opreturnPath), 0755); err != nil {
		return fmt.Errorf("failed to create OP_RETURN path dir: %v", err)
	}
	if err := os.WriteFile(opreturnPath, []byte(hex.EncodeToString(buf.Bytes())), 0644); err != nil {
		return fmt.Errorf("failed to write OP_RETURN tx: %v", err)
	}

	fmt.Println("OP_RETURN tx (hex) saved to", opreturnPath)
	return nil
}
