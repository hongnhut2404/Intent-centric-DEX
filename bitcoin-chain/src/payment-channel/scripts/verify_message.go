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
	"strings"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

func AddSenderPubKeyToMessage(jsonPath, bobPubKeyHex string) error {
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to read payment message: %v", err)
	}

	var msg map[string]interface{}
	if err := json.Unmarshal(data, &msg); err != nil {
		return fmt.Errorf("invalid JSON: %v", err)
	}

	msg["sender_pubkey"] = bobPubKeyHex

	updated, err := json.MarshalIndent(msg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated JSON: %v", err)
	}

	if err := os.WriteFile(jsonPath, updated, 0644); err != nil {
		return fmt.Errorf("failed to write updated payment message: %v", err)
	}

	fmt.Println("Bob's sender_pubkey added to", filepath.Base(jsonPath))
	return nil
}

func loadBobPubKey(statePath string) (string, error) {
	file, err := os.ReadFile(statePath)
	if err != nil {
		return "", fmt.Errorf("failed to read state file: %v", err)
	}

	var state map[string]map[string]string
	if err := json.Unmarshal(file, &state); err != nil {
		return "", fmt.Errorf("invalid JSON in state file: %v", err)
	}

	bob, ok := state["bob"]
	if !ok {
		return "", fmt.Errorf("missing 'bob' entry")
	}
	pubHex := bob["pubkey"]
	if pubHex == "" {
		return "", fmt.Errorf("missing 'pubkey' for bob")
	}

	return pubHex, nil
}

func ExtractOpReturnMessage(txHexPath string) (string, error) {
	raw, err := os.ReadFile(txHexPath)
	if err != nil {
		return "", fmt.Errorf("failed to read tx file: %v", err)
	}

	txBytes, err := hex.DecodeString(strings.TrimSpace(string(raw)))
	if err != nil {
		return "", fmt.Errorf("failed to decode tx hex: %v", err)
	}

	var tx wire.MsgTx
	if err := tx.DeserializeNoWitness(bytes.NewReader(txBytes)); err != nil {
		return "", fmt.Errorf("failed to deserialize transaction: %v", err)
	}

	for _, out := range tx.TxOut {
		if txscript.GetScriptClass(out.PkScript) == txscript.NullDataTy {
			data, err := txscript.PushedData(out.PkScript)
			if err != nil {
				return "", fmt.Errorf("failed to extract OP_RETURN data: %v", err)
			}
			if len(data) > 0 {
				return string(data[0]), nil
			}
		}
	}

	return "", fmt.Errorf("no OP_RETURN output found")
}

func VerifyPaymentMessageWithExtracted(opReturn string, jsonPath string, statePath string) error {
	parts := strings.Split(opReturn, "|")
	if len(parts) != 2 {
		return fmt.Errorf("invalid OP_RETURN format: expected 'amount|secret_hash'")
	}

	amountFloat, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return fmt.Errorf("invalid amount in OP_RETURN: %v", err)
	}
	amountStr := strconv.FormatFloat(amountFloat, 'f', -1, 64)
	secretHash := parts[1]

	// Load payment message
	file, err := os.Open(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to open message file: %v", err)
	}
	defer file.Close()

	var msg PaymentMessage
	if err := json.NewDecoder(file).Decode(&msg); err != nil {
		return fmt.Errorf("failed to parse payment message: %v", err)
	}

	if amountFloat != msg.BTCAmount {
		return fmt.Errorf("amount mismatch: expected %.8f, got %.8f", amountFloat, msg.BTCAmount)
	}
	if msg.SecretHash != secretHash {
		return fmt.Errorf("secret hash mismatch")
	}

	// Verify signature
	digest := sha256.Sum256([]byte(msg.SecretHash + "|" + amountStr))
	fmt.Println("Verifying message:", msg.SecretHash+"|"+amountStr)

	pubBytes, err := hex.DecodeString(msg.PubKey)
	if err != nil {
		return fmt.Errorf("invalid pubkey: %v", err)
	}
	pubKey, err := btcec.ParsePubKey(pubBytes)
	if err != nil {
		return fmt.Errorf("failed to parse pubkey: %v", err)
	}

	sigBytes, err := hex.DecodeString(msg.Signature)
	if err != nil {
		return fmt.Errorf("invalid signature hex: %v", err)
	}
	sig, err := ecdsa.ParseDERSignature(sigBytes)
	if err != nil {
		return fmt.Errorf("failed to parse signature: %v", err)
	}

	if !sig.Verify(digest[:], pubKey) {
		return fmt.Errorf("signature verification failed")
	}
	fmt.Println("Signature verification successful ✅")

	bobPubKey, err := loadBobPubKey(statePath)
	if err != nil {
		return fmt.Errorf("failed to load Bob's pubkey: %v", err)
	}

	if err := AddSenderPubKeyToMessage(jsonPath, bobPubKey); err != nil {
		return fmt.Errorf("failed to inject sender_pubkey: %v", err)
	}

	return nil
}
