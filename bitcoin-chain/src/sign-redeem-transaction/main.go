package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/btcsuite/btcd/chaincfg"
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

func readRedeemTransaction() (string, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/redeem-tx.json"
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
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
	data, err := ReadInput(path)
	if err != nil {
		return nil, err
	}

	receiverList, ok := data["receiver"].([]interface{})
	if !ok || len(receiverList) == 0 {
		return nil, fmt.Errorf("missing or invalid 'receiver' field")
	}

	return receiverList[0].(map[string]interface{}), nil
}

func readHTLCInfo() (map[string]interface{}, error) {
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/address-test.json"
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
	path := "/home/nhutthi/Documents/bitcoin-28.1/data-script/alice/htlc-data.json"
	data, err := ReadInput(path)
	if err != nil {
		return "", err
	}

	secret, ok := data["secret"].(string)
	if !ok || len(secret) == 0 {
		return "", fmt.Errorf("missing or invalid 'secret' field")
	}

	return secret, nil
}

func main() {
	// Regtest network parameters
	netParams := &chaincfg.RegressionNetParams

	//Read input data
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
	}
	secret, err := readSecretPreimage()
	if err != nil {
		fmt.Printf("Error reading secret: %v\n", err)
	}

	tx, err := decodeTx(txHex)
	if err != nil {
		fmt.Printf("Error decoding transaction: %v\n", err)
		return
	}
	// Example input for signing transaction
	signInput := InputSignRedeemTransaction{
		tx:                 tx,
		redeemScript:       htlcMap["redeemScript"].(string),
		mySecret:           secret, // Replace with actual preimage
		receiverPrivKeyWif: receiverMap["privkey"].(string),
		receiverPubKey:     receiverMap["pubkey"].(string),
	}

	// Sign transaction
	signedTxHex, err := signTransaction(signInput, netParams)
	if err != nil {
		fmt.Printf("Error signing transaction: %v\n", err)
		return
	}

	fmt.Println("Signed transaction hex:", signedTxHex)
}
