package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// SendSignedTransaction sends a signed raw transaction to the Bitcoin regtest blockchain.
func SendSignedTransaction(signedTxHex string) (string, error) {
	// Validate hex string
	if _, err := hex.DecodeString(signedTxHex); err != nil {
		return "", fmt.Errorf("failed to decode transaction hex: %v", err)
	}

	// Prepare JSON-RPC request
	rpcRequest := map[string]interface{}{
		"jsonrpc": "1.0",
		"id":      "1",
		"method":  "sendrawtransaction",
		"params":  []interface{}{signedTxHex},
	}
	requestBody, err := json.Marshal(rpcRequest)
	if err != nil {
		return "", fmt.Errorf("failed to marshal RPC request: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", "http://127.0.0.1:8332", bytes.NewReader(requestBody))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %v", err)
	}
	req.SetBasicAuth("admin", "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso")
	req.Header.Set("Content-Type", "application/json")

	// Send HTTP request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send HTTP request: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	// Parse JSON-RPC response
	var rpcResponse struct {
		Result string `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &rpcResponse); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %v", err)
	}

	// Check for RPC error
	if rpcResponse.Error != nil {
		return "", fmt.Errorf("RPC error: %s (code %d)", rpcResponse.Error.Message, rpcResponse.Error.Code)
	}

	// Return transaction hash
	if rpcResponse.Result == "" {
		return "", fmt.Errorf("no transaction hash returned")
	}
	return rpcResponse.Result, nil
}

func main() {
	// Signed transaction hex string
	signedTxHex := "010000000001019bb3f3a7e5e4c905ccea442e04ed3e24338c608c265b5b05c7d99a1a0541da5e0000000000ffffffff01c0878b3b00000000160014b28f182fa373f009642491ac37203c3fc7c35fde0447304402202110600babbf5d43ed3a312a800a29a01a1832c879e33a33343cecc73fdabf7202206295b4e9f37f3807460a54db93c5af9e804124bb9c5d0b1b00aff983bcd255b383086d7973656372657401017163a820652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0882102578db1df79bb2068c4fc808ec9da1a8c3cb35d654b1599c9c7ea8f3dcb358958ac6702c800b17521030da87c54462810fe8f7453599fe54d025f3aac07937bcebfe4a0e386281f03bbac6800000000"

	txHash, err := SendSignedTransaction(signedTxHex)
	if err != nil {
		fmt.Printf("Error sending transaction: %v\n", err)
		return
	}
	fmt.Printf("Transaction sent successfully with hash: %s\n", txHash)
}
