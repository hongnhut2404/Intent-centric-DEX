package main

import (
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

// === Readers ===
func readRedeemTransaction() (string, error) {
	path := os.Getenv("REDEEM_TX_OUTPUT")
	if path == "" {
		return "", fmt.Errorf("REDEEM_TX_INPUT not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return "", err
	}
	redeemTx, ok := data["raw_redeem_transaction"].(string)
	if !ok {
		return "", fmt.Errorf("missing unsigned redeem transaction")
	}
	return redeemTx, nil
}

func readReceiverInfo() (map[string]interface{}, error) {
	path := os.Getenv("STATE_PATH_HTLC")
	if path == "" {
		return nil, fmt.Errorf("STATE_PATH_HTLC not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read state.json: %v", err)
	}

	alice, ok := data["alice"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("missing or invalid 'alice' field in state.json")
	}
	return alice, nil
}

func readHTLCInfo() (map[string]interface{}, error) {
	path := os.Getenv("ADDRESS_TEST")
	if path == "" {
		return nil, fmt.Errorf("ADDRESS_TEST not set in .env")
	}
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}

	htlcInfo, ok := data["HTLC"].([]interface{})
	if !ok || len(htlcInfo) == 0 {
		return nil, fmt.Errorf("missing or invalid 'HTLC' field")
	}

	return htlcInfo[0].(map[string]interface{}), nil
}

func readSecretPreimage() (string, error) {
	path := os.Getenv("EXCHANGE_DATA_HTLC")
	if path == "" {
		return "", fmt.Errorf("EXCHANGE_DATA_HTLC not set in .env")
	}

	data, err := ReadInput(path) // map[string]interface{}
	if err != nil {
		return "", err
	}

	// 1) Preferred: top-level baseSecret
	if v, ok := data["baseSecret"].(string); ok && v != "" {
		return v, nil
	}

	// 2) Fallback: htlcs[0].secretBase
	htlcs, ok := data["htlcs"].([]interface{})
	if !ok || len(htlcs) == 0 {
		return "", fmt.Errorf("missing 'baseSecret' and no 'htlcs' entries in %s", path)
	}
	first, ok := htlcs[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid structure for 'htlcs[0]' in %s", path)
	}
	if v, ok := first["secretBase"].(string); ok && v != "" {
		return v, nil
	}

	return "", fmt.Errorf("could not find base secret (checked 'baseSecret' and 'htlcs[0].secretBase') in %s", path)
}

// === Main ===
func main() {
	loadEnv()
	netParams := &chaincfg.RegressionNetParams

	secret, err := readSecretPreimage()
	if err != nil {
		fmt.Printf("Error reading secret from exchange data: %v\n", err)
		return
	}

	txHex, err := readRedeemTransaction()
	if err != nil {
		fmt.Printf("Error reading redeem transaction: %v\n", err)
		return
	}

	receiverMap, err := readReceiverInfo()
	if err != nil {
		fmt.Printf("Error reading receiver information: %v\n", err)
		return
	}

	htlcMap, err := readHTLCInfo()
	if err != nil {
		fmt.Printf("Error reading htlc information: %v\n", err)
		return
	}

	tx, err := decodeTx(txHex)
	if err != nil {
		fmt.Printf("Error decoding transaction: %v\n", err)
		return
	}

	signInput := InputSignRedeemTransaction{
		tx:                 tx,
		redeemScript:       htlcMap["redeemScript"].(string),
		mySecret:           secret,
		receiverPrivKeyWif: receiverMap["privkey"].(string),
		receiverPubKey:     receiverMap["pubkey"].(string),
	}

	signedTxHex, err := signTransaction(signInput, netParams)
	if err != nil {
		fmt.Printf("Error signing transaction: %v\n", err)
		return
	}

	fmt.Println("Signed transaction hex:", signedTxHex)
}
