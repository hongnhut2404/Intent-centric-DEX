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
	paths := []string{"../../.env", "../.env", "./.env"} // flexible search
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from known locations")
}

// === Reusable JSON Reader ===
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

// === Read UTXO ===
func readUTXO() (map[string]interface{}, error) {
	path := os.Getenv("UTXO_JSON")
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}
	unspentsRaw, ok := data["unspents"]
	if !ok || unspentsRaw == nil {
		return nil, fmt.Errorf("missing or null 'unspents' field")
	}
	unspents, ok := unspentsRaw.([]interface{})
	if !ok || len(unspents) == 0 {
		return nil, fmt.Errorf("'unspents' is not a non-empty array")
	}
	return unspents[0].(map[string]interface{}), nil
}

// === Read Party Info ===
func readPartyInfo() (map[string]interface{}, map[string]interface{}, error) {
	path := os.Getenv("ADDRESS_TEST")
	data, err := ReadInput(path)
	if err != nil {
		return nil, nil, err
	}

	senderList, ok := data["sender"].([]interface{})
	if !ok || len(senderList) == 0 {
		return nil, nil, fmt.Errorf("missing or invalid 'sender' field")
	}
	htlcList, ok := data["HTLC"].([]interface{})
	if !ok || len(htlcList) == 0 {
		return nil, nil, fmt.Errorf("missing or invalid 'HTLC' field")
	}

	return senderList[0].(map[string]interface{}), htlcList[0].(map[string]interface{}), nil
}

// === Main Function ===
func main() {
	loadEnv()
	firstUnspent, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	senderMap, htlcMap, err := readPartyInfo()
	if err != nil {
		log.Fatalf("Failed to read party info: %v", err)
	}

	// Prepare inputs
	inputs := []TxInput{
		{
			TxID: firstUnspent["txid"].(string),
			Vout: int(firstUnspent["vout"].(float64)),
		},
	}

	// Prepare outputs
	outputs1 := []TxOutput{
		{Address: htlcMap["address"].(string), Amount: 10},
		{Address: senderMap["address"].(string), Amount: 89.9999},
	}

	rawTx1, err := CreateRawTransaction(inputs, outputs1, nil, nil)
	if err != nil {
		log.Fatalf("Failed to create raw transaction (address output): %v", err)
	}
	output := map[string]interface{}{
		"raw_transaction": rawTx1,
	}
	fmt.Println("Raw transaction: ", output["raw_transaction"].(string))
	outputPath := os.Getenv("RAW_TX_OUTPUT")
	err = WriteOutput(outputPath, output)
	if err != nil {
		log.Fatalf("Failed to write raw transaction: %v", err)
	}

	fmt.Println("Saved raw transaction to rawtx.json")

}
