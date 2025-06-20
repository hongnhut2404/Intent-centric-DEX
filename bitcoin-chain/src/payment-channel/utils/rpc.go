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

func SendToAddress(rpcURL, user, pass, addr string, amount float64) error {
	reqBody := rpcRequest{
		Jsonrpc: "1.0",
		ID:      "sendtoaddress",
		Method:  "sendtoaddress",
		Params:  []interface{}{addr, amount},
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.SetBasicAuth(user, pass)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return err
	}
	if rpcResp.Error != nil {
		return fmt.Errorf("RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	fmt.Println("Transaction ID:", string(rpcResp.Result))
	return nil
}
