package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/btcsuite/btcd/chaincfg"
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

// === Read UTXO ===
func readUTXO() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/utxo-htlc.json"
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
func readPartyInfo() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}

	receiverList, ok := data["receiver"].([]interface{})
	if !ok || len(receiverList) == 0 {
		return nil, fmt.Errorf("missing or invalid 'sender' field")
	}

	return receiverList[0].(map[string]interface{}), nil
}

func main() {
	// Regtest network parameters
	netParams := &chaincfg.RegressionNetParams

	firstUnspent, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	receiverMap, err := readPartyInfo()
	if err != nil {
		log.Fatalf("Failed to read party info: %v", err)
	}

	rawInput := InputRawRedeemTransaction{
		prevTxHash:      firstUnspent["txid"].(string),
		prevOutputIndex: uint32(firstUnspent["vout"].(float64)),
		outputAddr:      receiverMap["address"].(string),
		outputAmount:    9.99990000,
	}

	tx, err := createRawTransaction(rawInput, netParams)
	if err != nil {
		fmt.Printf("Error creating raw transaction: %v\n", err)
		return
	}

	var buf bytes.Buffer
	err = tx.Serialize(&buf)
	if err != nil {
		fmt.Printf("Failed to serialize transaction: %v\n", err)
		return
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Raw redeem transaction (hex):", rawTxHex)

	// Save to JSON file
	output := map[string]interface{}{
		"raw_redeem_transaction": rawTxHex,
	}

	err = WriteOutput("/home/nhutthi/Documents/bitcoin-28.1/data-script/redeem-tx.json", output)
	if err != nil {
		log.Fatalf("Failed to write raw redeem transaction: %v", err)
	}

	fmt.Println("Transaction saved to redeem-tx.json")
}
