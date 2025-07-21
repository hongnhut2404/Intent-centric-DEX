package scripts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"github.com/btcsuite/btcd/btcec/v2"
)

type PaymentMessage struct {
	BTCAmount  float64 `json:"btc_amount"`
	Secret     string  `json:"secret"`
	SecretHash string  `json:"secret_hash"`
	Signature  string  `json:"signature"`
	PubKey     string  `json:"pubkey"`
}

// GeneratePaymentMessage creates a signed payment message and writes it to JSON
func GeneratePaymentMessage(secret string, btcAmountStr string, outputPath string) error {
	btcAmount, err := strconv.ParseFloat(btcAmountStr, 64)
	if err != nil {
		return fmt.Errorf("invalid BTC amount: %v", err)
	}

	// Generate random key for this message
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		return fmt.Errorf("failed to generate key: %v", err)
	}
	pubKey := privKey.PubKey()

	// Create and sign message digest
	raw := []byte(secret + "|" + btcAmountStr)
	digest := sha256.Sum256(raw)
	sig, err := privKey.Sign(digest[:])
	if err != nil {
		return fmt.Errorf("signing failed: %v", err)
	}

	secretHashBytes := sha256.Sum256([]byte(secret))

	message := PaymentMessage{
		BTCAmount:  btcAmount,
		Secret:     secret,
		SecretHash: hex.EncodeToString(secretHashBytes[:]),
		Signature:  hex.EncodeToString(sig.Serialize()),
		PubKey:     hex.EncodeToString(pubKey.SerializeCompressed()),
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	err = encoder.Encode(&message)
	if err != nil {
		return fmt.Errorf("failed to encode message: %v", err)
	}

	fmt.Println("Payment message written to", outputPath)
	fmt.Println("Secret Hash (for Bitcoin HTLC):", message.SecretHash)

	return nil
}
