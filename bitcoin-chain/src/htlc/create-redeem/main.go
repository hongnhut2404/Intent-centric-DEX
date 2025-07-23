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
	"github.com/joho/godotenv"
)

// === Load .env ===
func loadEnv() {
	paths := []string{"../../../.env", "../../.env", "../.env", "./.env"}
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from known locations")
}

// === JSON Reader/Writer ===
func ReadInput(filePath string) (map[string]interface{}, error) {
	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("unable to read file: %w", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}
	return result, nil
}

func WriteOutput(filePath string, data interface{}) error {
	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal output: %w", err)
	}
	return ioutil.WriteFile(filePath, out, 0644)
}

// === Read UTXO ===
func readUTXO() (map[string]interface{}, error) {
	path := os.Getenv("UTXO_HTLC_JSON")
	if path == "" {
		return nil, fmt.Errorf("UTXO_HTLC_JSON not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}
	unspentsRaw := data["unspents"].([]interface{})
	return unspentsRaw[0].(map[string]interface{}), nil
}

// === Read Receiver Info from state.json (Alice) ===
func readPartyInfo() (map[string]interface{}, error) {
	path := os.Getenv("STATE_PATH_HTLC")
	if path == "" {
		return nil, fmt.Errorf("STATE_PATH_HTLC not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}
	return data["alice"].(map[string]interface{}), nil
}

// === Read BTC amount from payment message ===
func readBTCAmountFromMessage() (float64, error) {
	path := os.Getenv("PAYMENT_MESSAGE_HTLC")
	if path == "" {
		return 0, fmt.Errorf("PAYMENT_MESSAGE_HTLC not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return 0, err
	}
	amount, ok := data["btc_amount"].(float64)
	if !ok {
		return 0, fmt.Errorf("invalid or missing btc_amount field")
	}
	return amount, nil
}

// === Main ===
func main() {
	loadEnv()
	netParams := &chaincfg.RegressionNetParams
	const feeSats = 500
	const satsPerBTC = 1e8

	firstUnspent, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	receiverMap, err := readPartyInfo()
	if err != nil {
		log.Fatalf("Failed to read party info: %v", err)
	}

	btcAmount, err := readBTCAmountFromMessage()
	if err != nil {
		log.Fatalf("Failed to read BTC amount: %v", err)
	}

	outputAmount := (btcAmount*satsPerBTC - feeSats) / satsPerBTC

	rawInput := InputRawRedeemTransaction{
		prevTxHash:      firstUnspent["txid"].(string),
		prevOutputIndex: uint32(firstUnspent["vout"].(float64)),
		outputAddr:      receiverMap["address"].(string),
		outputAmount:    outputAmount,
	}

	tx, err := createRawTransaction(rawInput, netParams)
	if err != nil {
		log.Fatalf("Error creating raw transaction: %v", err)
	}

	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		log.Fatalf("Failed to serialize transaction: %v", err)
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Raw redeem transaction (hex):", rawTxHex)

	output := map[string]interface{}{
		"raw_redeem_transaction": rawTxHex,
	}
	outputPath := os.Getenv("REDEEM_TX_OUTPUT")
	if outputPath == "" {
		log.Fatal("REDEEM_TX_OUTPUT not set in .env")
	}
	if err := WriteOutput(outputPath, output); err != nil {
		log.Fatalf("Failed to write raw redeem transaction: %v", err)
	}

	fmt.Println("Transaction saved to redeem-tx.json")
}
