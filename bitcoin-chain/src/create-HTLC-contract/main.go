package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/joho/godotenv"
)

func loadEnv() {
	paths := []string{"../../.env", "../.env", "./.env"}
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from any known location")
}

func ReadInput(filePath string) (map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("unable to open file: %w", err)
	}
	defer file.Close()

	bytes, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("unable to read file: %w", err)
	}

	var data map[string]interface{}
	err = json.Unmarshal(bytes, &data)
	if err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}

	return data, nil
}

func WriteOutput(filePath string, data interface{}) error {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal output: %w", err)
	}

	err = ioutil.WriteFile(filePath, bytes, 0644)
	if err != nil {
		return fmt.Errorf("failed to write output to file: %w", err)
	}
	return nil
}

// ----------------------------- New Logic -----------------------------

func readStateParticipants() (sender map[string]interface{}, receiver map[string]interface{}, err error) {
	path := "payment-channel/data/state.json"
	data, err := ReadInput(path)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read state.json: %w", err)
	}

	bob, ok1 := data["bob"].(map[string]interface{})
	alice, ok2 := data["alice"].(map[string]interface{})
	if !ok1 || !ok2 {
		return nil, nil, fmt.Errorf("invalid format: missing 'bob' or 'alice'")
	}
	return bob, alice, nil
}

func readSecretHashFromMessage() (string, error) {
	path := "payment-channel/data/payment_message.json"
	data, err := ReadInput(path)
	if err != nil {
		return "", fmt.Errorf("failed to read payment_message.json: %w", err)
	}

	secretHash, ok := data["secret_hash"].(string)
	if !ok || secretHash == "" {
		return "", fmt.Errorf("missing or invalid 'secret_hash'")
	}
	return secretHash, nil
}

func updateHTLCOutput(filePath, address, redeemScript string) error {
	data, err := ReadInput(filePath)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	newHTLC := map[string]interface{}{
		"address":      address,
		"redeemScript": redeemScript,
	}
	data["HTLC"] = []interface{}{newHTLC}

	err = WriteOutput(filePath, data)
	if err != nil {
		return fmt.Errorf("failed to write updated HTLC: %w", err)
	}
	return nil
}

// ----------------------------- Main -----------------------------

func main() {
	loadEnv()

	// Load sender (Bob) and receiver (Alice)
	sender, receiver, err := readStateParticipants()
	if err != nil {
		log.Fatalf("Failed to read participants: %v", err)
	}
	senderPubKeyHex := sender["pubkey"].(string)
	receiverPubKeyHex := receiver["pubkey"].(string)

	// Load secret hash from payment message
	secretHash, err := readSecretHashFromMessage()
	if err != nil {
		log.Fatalf("Failed to read secret hash: %v", err)
	}
	fmt.Printf("SHA256 Hash: %s\n", secretHash)

	// Set locktime for HTLC
	locktime := int64(300) // block height or timestamp

	// Create HTLC redeem script and address
	p2shAddress, redeemScriptHex, err := CreateHTLCContract(senderPubKeyHex, receiverPubKeyHex, secretHash, locktime)
	if err != nil {
		log.Fatalf("Failed to create HTLC: %v", err)
	}

	fmt.Println("HTLC Contract Created:")
	fmt.Printf("P2SH Address:      %s\n", p2shAddress)
	fmt.Printf("Redeem Script Hex: %s\n", redeemScriptHex)

	// Save into output JSON file (e.g., ADDRESS_TEST path)
	outputPath := os.Getenv("ADDRESS_TEST")
	if outputPath == "" {
		log.Fatal("Missing ADDRESS_TEST in .env")
	}
	if err := updateHTLCOutput(outputPath, p2shAddress, redeemScriptHex); err != nil {
		log.Fatalf("Failed to update JSON: %v", err)
	}
}
