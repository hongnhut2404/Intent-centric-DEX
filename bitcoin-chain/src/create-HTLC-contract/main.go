package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
)

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

func readSenderInfo() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}

	senderInfo, ok := data["sender"].([]interface{})
	if !ok || len(senderInfo) == 0 {
		return nil, fmt.Errorf("missing or invalid 'Sender' field")
	}

	return senderInfo[0].(map[string]interface{}), nil
}

func readReceiverInfo() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}

	receiverInfo, ok := data["receiver"].([]interface{})
	if !ok || len(receiverInfo) == 0 {
		return nil, fmt.Errorf("missing or invalid 'Receiver' field")
	}

	return receiverInfo[0].(map[string]interface{}), nil
}

func readSecretHash() (string, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/bob/exchange-data.json"
	data, err := ReadInput(path)
	if err != nil {
		return "", err
	}

	secretHash, ok := data["hashSha256"].(string)
	if !ok || secretHash == "" {
		return "", fmt.Errorf("missing or invalid 'hashSha256' field")
	}

	return secretHash, nil
}

func updateHTLCOutput(filePath, address, redeemScript string) error {
	data, err := ReadInput(filePath)
	if err != nil {
		return fmt.Errorf("failed to read input: %w", err)
	}

	// Create new HTLC entry
	newHTLC := map[string]interface{}{
		"address":      address,
		"redeemScript": redeemScript,
	}

	// Replace "HTLC" field
	data["HTLC"] = []interface{}{newHTLC}

	// Write back to file
	err = WriteOutput(filePath, data)
	if err != nil {
		return fmt.Errorf("failed to write updated HTLC: %w", err)
	}
	return nil
}

func main() {
	// Read sender info
	sender, err := readSenderInfo()
	if err != nil {
		log.Fatalf("Failed to read sender info: %v", err)
	}
	senderPubKeyHex, _ := sender["pubkey"].(string)

	// Read receiver info
	receiver, err := readReceiverInfo()
	if err != nil {
		log.Fatalf("Failed to read receiver info: %v", err)
	}
	receiverPubKeyHex, _ := receiver["pubkey"].(string)

	// Read secret hash
	hashSecretHex, err := readSecretHash()
	if err != nil {
		log.Fatalf("Failed to read secret hash: %v", err)
	}
	fmt.Printf("SHA256 Hash: %s\n", hashSecretHex)

	// Example locktime (block height or timestamp)
	locktime := int64(200)

	// Create HTLC contract
	p2shAddress, redeemScriptHex, err := CreateHTLCContract(senderPubKeyHex, receiverPubKeyHex, hashSecretHex, locktime)
	if err != nil {
		log.Fatalf("Failed to create HTLC: %v", err)
	}

	fmt.Println("HTLC Contract Created:")
	fmt.Printf("P2SH Address:      %s\n", p2shAddress)
	fmt.Printf("Redeem Script Hex: %s\n", redeemScriptHex)

	// Write back to JSON
	jsonPath := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
	err = updateHTLCOutput(jsonPath, p2shAddress, redeemScriptHex)
	if err != nil {
		log.Fatalf("Failed to update JSON: %v", err)
	}
}
