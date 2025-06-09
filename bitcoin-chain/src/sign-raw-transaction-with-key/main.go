package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
)

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
// === Read UTXO ===
func readUTXO() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/utxo.json"
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
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
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

func readRawTx() (string, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/rawtx.json"

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
	// Raw transaction (claim output)
	rawTx, err := readRawTx()
	if err != nil {
		log.Fatalf("Failed to read info: %v", err)
	}
	firstUnspent, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	senderMap, htlcMap, err := readPartyInfo()
	if err != nil {
		log.Fatalf("Failed to read party info: %v", err)
	}

	// Example private key (replace with actual private keys)
	privKeys := []string{
		senderMap["privkey"].(string),
	}

	// The previous transaction that contains the HTLqC output
	prevTxs := []PrevTx{
		{
			Txid:         firstUnspent["txid"].(string),
			Vout:         int(firstUnspent["vout"].(float64)),
			ScriptPubKey: firstUnspent["scriptPubKey"].(string), // Updated scriptPubKey
			RedeemScript: htlcMap["redeemScript"].(string),      // HTLC redeem script
			Amount:       firstUnspent["amount"].(float64),      // Correct amount
		},
	}

	// Sighash type
	sighash := "ALL"

	fmt.Printf("Raw Transaction before signing: %s\n", rawTx)

	// Sign the raw transaction
	signedTx, err := SignRawTransactionWithKey(rawTx, privKeys, prevTxs, sighash)
	if err != nil {
		log.Fatalf("Signing failed: %v\n", err)
		return
	}

	// Print the signed transaction
	fmt.Printf("Signed Transaction Hex: %s\n", signedTx)
}
