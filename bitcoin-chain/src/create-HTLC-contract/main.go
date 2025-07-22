package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/joho/godotenv"
)

type HTLCInput struct {
	BTCAmount   float64 `json:"btc_amount"`
	SecretHash  string  `json:"secret_hash"`
	ReceiverPub string  `json:"pubkey"`
	SenderPub   string  `json:"sender_pubkey"`
	Signature   string  `json:"signature"`
}

func loadEnv() {
	paths := []string{"../../.env", "../.env", "./.env"}
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from any known location")
}

func readHTLCInput(path string) (*HTLCInput, error) {
	raw, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read input: %w", err)
	}
	var input HTLCInput
	if err := json.Unmarshal(raw, &input); err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}
	return &input, nil
}

func updateHTLCOutput(filePath, address, redeemScript string) error {
	raw, err := ioutil.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read output file: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		return fmt.Errorf("failed to parse output file: %w", err)
	}

	data["HTLC"] = []interface{}{map[string]interface{}{
		"address":      address,
		"redeemScript": redeemScript,
	}}

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode updated output: %w", err)
	}

	return ioutil.WriteFile(filePath, out, 0644)
}

func main() {
	loadEnv()

	input, err := readHTLCInput("../payment-channel/data/payment_message.json")
	if err != nil {
		log.Fatalf("Failed to read HTLC input: %v", err)
	}

	locktime := int64(300)

	address, redeemScript, err := CreateHTLCContract(
		input.SenderPub,
		input.ReceiverPub,
		input.SecretHash,
		locktime,
	)
	if err != nil {
		log.Fatalf("Failed to create HTLC contract: %v", err)
	}

	fmt.Println("HTLC Contract Created:")
	fmt.Printf("P2SH Address:      %s\n", address)
	fmt.Printf("Redeem Script Hex: %s\n", redeemScript)

	outputPath := os.Getenv("ADDRESS_TEST")
	if outputPath == "" {
		log.Fatal("Missing ADDRESS_TEST in .env")
	}
	if err := updateHTLCOutput(outputPath, address, redeemScript); err != nil {
		log.Fatalf("Failed to update HTLC output file: %v", err)
	}
}
