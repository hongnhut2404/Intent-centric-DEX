package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/joho/godotenv"
)

// === Load .env ===
func loadEnv() {
	paths := []string{"../../.env", "../.env", "./.env"}
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

// === Read UTXO ===
func readUTXO() (map[string]interface{}, error) {
	path := os.Getenv("UTXO_JSON")
	if path == "" {
		return nil, fmt.Errorf("UTXO_JSON not set in .env")
	}
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
	if path == "" {
		return nil, nil, fmt.Errorf("ADDRESS_TEST not set in .env")
	}
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

// === Read Raw Transaction ===
func readRawTx() (string, error) {
	path := os.Getenv("RAW_TX_INPUT")
	if path == "" {
		return "", fmt.Errorf("RAW_TX_INPUT not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return "", err
	}

	raw, ok := data["raw_transaction"].(string)
	if !ok {
		return "", fmt.Errorf("'raw_transaction' is not a string or missing")
	}
	return raw, nil
}

func main() {
	loadEnv()

	rawTx, err := readRawTx()
	if err != nil {
		log.Fatalf("Failed to read raw transaction: %v", err)
	}

	firstUnspent, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	senderMap, htlcMap, err := readPartyInfo()
	if err != nil {
		log.Fatalf("Failed to read party info: %v", err)
	}

	privKeys := []string{
		senderMap["privkey"].(string),
	}

	prevTxs := []PrevTx{
		{
			Txid:         firstUnspent["txid"].(string),
			Vout:         int(firstUnspent["vout"].(float64)),
			ScriptPubKey: firstUnspent["scriptPubKey"].(string),
			RedeemScript: htlcMap["redeemScript"].(string),
			Amount:       firstUnspent["amount"].(float64),
		},
	}

	sighash := "ALL"

	fmt.Printf("Raw Transaction before signing: %s\n", rawTx)

	signedTx, err := SignRawTransactionWithKey(rawTx, privKeys, prevTxs, sighash)
	if err != nil {
		log.Fatalf("Signing failed: %v", err)
	}

	fmt.Printf("Signed Transaction Hex: %s\n", signedTx)
}
