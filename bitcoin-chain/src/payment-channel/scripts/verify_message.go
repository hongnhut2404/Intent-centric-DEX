package scripts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
)

func VerifyPaymentMessage(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open message file: %v", err)
	}
	defer file.Close()

	var msg PaymentMessage
	if err := json.NewDecoder(file).Decode(&msg); err != nil {
		return fmt.Errorf("failed to parse message file: %v", err)
	}

	expectedHash := sha256.Sum256([]byte(msg.Secret))
	if msg.SecretHash != hex.EncodeToString(expectedHash[:]) {
		return fmt.Errorf("invalid secret hash")
	}

	raw := []byte(msg.Secret + "|" + fmt.Sprintf("%.8f", msg.BTCAmount))
	digest := sha256.Sum256(raw)

	pubBytes, _ := hex.DecodeString(msg.PubKey)
	pubKey, _ := btcec.ParsePubKey(pubBytes)

	sigBytes, _ := hex.DecodeString(msg.Signature)
	sig, err := ecdsa.ParseDERSignature(sigBytes)
	if err != nil {
		return fmt.Errorf("signature parsing failed: %v", err)
	}

	if !sig.Verify(digest[:], pubKey) {
		return fmt.Errorf("signature verification failed")
	}

	fmt.Println("Signature valid")
	return nil
}
