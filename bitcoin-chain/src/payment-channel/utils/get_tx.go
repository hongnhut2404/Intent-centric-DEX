package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type TxDetail struct {
	Address string  `json:"address"`
	Vout    uint32  `json:"vout"`
	Amount  float64 `json:"amount"`
}

type TxResult struct {
	TxID          string     `json:"txid"`
	Details       []TxDetail `json:"details"`
	Amount        float64    `json:"amount"`
	Fee           float64    `json:"fee"`
	Confirmations int        `json:"confirmations"`
}

func GetTransaction(rpcURL, rpcUser, rpcPass, txid string) (*TxResult, error) {
	payload := map[string]interface{}{
		"jsonrpc": "1.0",
		"id":      "curltext",
		"method":  "gettransaction",
		"params":  []interface{}{txid},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("request error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(rpcUser, rpcPass)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("rpc error: %v", err)
	}
	defer resp.Body.Close()

	var result struct {
		Result TxResult    `json:"result"`
		Error  interface{} `json:"error"`
		ID     string      `json:"id"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode error: %v", err)
	}
	if result.Error != nil {
		return nil, fmt.Errorf("rpc returned error: %v", result.Error)
	}

	return &result.Result, nil
}
