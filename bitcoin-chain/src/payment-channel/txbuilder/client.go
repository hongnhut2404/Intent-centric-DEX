package txbuilder

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

const (
	rpcUser     = "admin"
	rpcPassword = "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"
	rpcURL      = "http://127.0.0.1:8332"
)

type RPCRequest struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type RPCResponse struct {
	Result json.RawMessage `json:"result"`
	Error  interface{}     `json:"error"`
	ID     string          `json:"id"`
}

func callRPC(method string, params []interface{}) (json.RawMessage, error) {
	reqData := RPCRequest{
		Jsonrpc: "1.0",
		ID:      "go-client",
		Method:  method,
		Params:  params,
	}

	reqBody, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	req.Header.Set("Content-Type", "text/plain")
	req.SetBasicAuth(rpcUser, rpcPassword)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response error: %w", err)
	}

	var rpcResp RPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("JSON decode error: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %v", rpcResp.Error)
	}

	return rpcResp.Result, nil
}
