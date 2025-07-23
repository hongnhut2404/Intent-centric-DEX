package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
)

func ScanHTLCUTXO() error {
	// Load HTLC address from address-test.json
	addressFile := "../../../data-script/address-test.json"
	raw, err := ioutil.ReadFile(addressFile)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", addressFile, err)
	}
	var data map[string][]map[string]string
	if err := json.Unmarshal(raw, &data); err != nil {
		return fmt.Errorf("invalid address JSON: %w", err)
	}
	htlcAddress := data["HTLC"][0]["address"]

	// Prepare descriptor format
	query := []interface{}{fmt.Sprintf("addr(%s)", htlcAddress)}
	params := []interface{}{query}

	// Call scantxoutset
	result, err := callRPC("scantxoutset", append([]interface{}{"start"}, params...))
	if err != nil {
		return fmt.Errorf("scantxoutset error: %w", err)
	}

	// Write result to output file
	outputFile := "../../../data-script/utxo-htlc.json"
	if err := ioutil.WriteFile(outputFile, result, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", outputFile, err)
	}

	log.Printf("Successfully scanned HTLC UTXO. Output saved to: %s", outputFile)
	return nil
}

func main() {
	if err := ScanHTLCUTXO(); err != nil {
		log.Fatalf("Error scanning HTLC UTXO: %v", err)
	}
}
