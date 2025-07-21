package scripts

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
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

// Load Alice's private key and pubkey from state.json
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

	privHex, ok := alice["privkey"]
	if !ok || privHex == "" {
		return nil, "", fmt.Errorf("missing 'privkey' for alice in state.json")
	}
	pubHex, ok := alice["pubkey"]
	if !ok || pubHex == "" {
		return nil, "", fmt.Errorf("missing 'pubkey' for alice in state.json")
	}

	privBytes, err := hex.DecodeString(privHex)
	if err != nil {
		return nil, "", fmt.Errorf("invalid hex in alice's privkey: %v", err)
	}
	privKey, _ := btcec.PrivKeyFromBytes(privBytes)

	return privKey, pubHex, nil
}

func GeneratePaymentMessage(secret string, btcAmountStr string, outputPath string) error {
	btcAmount, err := strconv.ParseFloat(btcAmountStr, 64)
	if err != nil {
		return fmt.Errorf("invalid BTC amount: %v", err)
	}

	// Load Alice's private key and pubkey
	privKey, pubKeyHex, err := loadAliceKeyPair("./data/state.json")
	if err != nil {
		return fmt.Errorf("failed to load Alice's key: %v", err)
	}

	// Hash the secret
	secretHashBytes := sha256.Sum256([]byte(secret))
	secretHash := hex.EncodeToString(secretHashBytes[:])

	// Sign the message: secretHash|amount
	raw := []byte(secretHash + "|" + btcAmountStr)
	digest := sha256.Sum256(raw)
	sig := ecdsa.Sign(privKey, digest[:])

	// Save signed message to JSON
	message := PaymentMessage{
		BTCAmount:  btcAmount,
		SecretHash: secretHash,
		Signature:  hex.EncodeToString(sig.Serialize()),
		PubKey:     pubKeyHex,
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(&message); err != nil {
		return fmt.Errorf("failed to encode JSON: %v", err)
	}

	fmt.Println("Payment message saved to", outputPath)
	fmt.Println("Secret Hash (for Bitcoin HTLC):", secretHash)

	// --- Create OP_RETURN output with amount|secretHash ---
	shortMsg := fmt.Sprintf("%.8f|%s", btcAmount, secretHash)
	shortMsgBytes := []byte(shortMsg)

	if len(shortMsgBytes) > 80 {
		return fmt.Errorf("OP_RETURN message too long: %d bytes", len(shortMsgBytes))
	}

	opReturnScript, err := txscript.NewScriptBuilder().
		AddOp(txscript.OP_RETURN).
		AddData(shortMsgBytes).
		Script()
	if err != nil {
		return fmt.Errorf("failed to build OP_RETURN script: %v", err)
	}

	tx := &wire.MsgTx{Version: 1}
	txOut := wire.NewTxOut(0, opReturnScript)
	tx.AddTxOut(txOut)

	fmt.Println("HasWitness:", tx.HasWitness())

	var buf bytes.Buffer
	if err := tx.SerializeNoWitness(&buf); err != nil {
		return fmt.Errorf("failed to serialize tx (no witness): %v", err)
	}

	if err := os.WriteFile("data/payment_opreturn.txt", []byte(hex.EncodeToString(buf.Bytes())), 0644); err != nil {
		return fmt.Errorf("failed to write OP_RETURN tx: %v", err)
	}

	fmt.Println("OP_RETURN tx (hex) saved to data/payment_opreturn.txt")
	return nil
}
