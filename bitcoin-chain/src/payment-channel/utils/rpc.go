package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type rpcRequest struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func SendToAddress(rpcURL, user, pass, addr string, amount float64) (string, error) {
	reqBody := rpcRequest{
		Jsonrpc: "1.0",
		ID:      "sendtoaddress",
		Method:  "sendtoaddress",
		Params:  []interface{}{addr, amount},
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(user, pass)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return "", err
	}
	if rpcResp.Error != nil {
		return "", fmt.Errorf("RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	var txid string
	if err := json.Unmarshal(rpcResp.Result, &txid); err != nil {
		return "", fmt.Errorf("failed to decode txid: %v", err)
	}

	fmt.Println("Transaction ID:", txid)
	return txid, nil
}

func SendToAddressWithDetails(rpcURL, user, pass, address string, amount float64) (txid string, vout uint32, err error) {
	// 1. Call `sendtoaddress`
	txid, err = SendToAddress(rpcURL, user, pass, address, amount)
	if err != nil {
		return "", 0, err
	}

	// 2. Call `gettransaction` to find vout
	txDetails, err := GetTransaction(rpcURL, user, pass, txid)
	if err != nil {
		return "", 0, err
	}
	for _, detail := range txDetails.Details {
		if detail.Address == address {
			return txid, detail.Vout, nil
		}
	}
	return txid, 0, fmt.Errorf("vout not found for address")
}
