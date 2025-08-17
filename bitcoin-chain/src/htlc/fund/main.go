// bitcoin-chain/src/fund/main.go
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ---------- Config ----------
const (
	rpcUser = "admin"
	rpcPass = "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"
	rpcURL  = "http://127.0.0.1:8332"

	// relative to this file's working dir (server runs this with cwd: bitcoin-chain/src/fund)
	dataDir = "../../../data-script"
)

// ---------- Types ----------
type rpcReq struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}
type rpcResp struct {
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
	ID     string          `json:"id"`
}
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type PaymentMessage struct {
	BTCAmount float64 `json:"btc_amount"`
	// other fields not needed here
}

type HTLCContract struct {
	P2SHAddress  string `json:"address"`
	RedeemScript string `json:"redeem_script"`
	// other fields optional (secret_hash, locktime, etc.)
}

// ---------- RPC helper ----------
func callRPC(method string, params []interface{}, out any) error {
	body, _ := json.Marshal(rpcReq{
		Jsonrpc: "1.0",
		ID:      "fund",
		Method:  method,
		Params:  params,
	})

	req, err := http.NewRequest("POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.SetBasicAuth(rpcUser, rpcPass)
	req.Header.Set("Content-Type", "application/json")

	cli := &http.Client{Timeout: 30 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rr rpcResp
	if err := json.NewDecoder(resp.Body).Decode(&rr); err != nil {
		return err
	}
	if rr.Error != nil {
		return fmt.Errorf("rpc error %d: %s", rr.Error.Code, rr.Error.Message)
	}
	if out != nil {
		return json.Unmarshal(rr.Result, out)
	}
	return nil
}

// ---------- IO helpers ----------
func readPaymentAmount() (float64, error) {
	f := filepath.Join(dataDir, "payment_message.json")
	fp, err := os.Open(f)
	if err != nil {
		return 0, fmt.Errorf("open payment_message.json: %w", err)
	}
	defer fp.Close()

	var msg PaymentMessage
	if err := json.NewDecoder(fp).Decode(&msg); err != nil {
		return 0, fmt.Errorf("decode payment_message.json: %w", err)
	}
	if msg.BTCAmount <= 0 {
		return 0, errors.New("btc_amount must be > 0 in payment_message.json")
	}
	return msg.BTCAmount, nil
}

func readHTLC() (*HTLCContract, error) {
	f := filepath.Join(dataDir, "address-test.json") // <-- we read address-test.json
	b, err := os.ReadFile(f)
	if err != nil {
		return nil, fmt.Errorf("open address-test.json: %w", err)
	}

	// 1) Try the array schema: { "HTLC": [ { "address": "...", "redeemScript": "..." } ] }
	var outer struct {
		HTLC []map[string]any `json:"HTLC"`
	}
	if err := json.Unmarshal(b, &outer); err == nil && len(outer.HTLC) > 0 {
		first := outer.HTLC[0]
		addr, _ := first["address"].(string)

		// camelCase in your file -> normalize to snake case field
		var redeem string
		if v, ok := first["redeemScript"].(string); ok && v != "" {
			redeem = v
		} else if v, ok := first["redeem_script"].(string); ok && v != "" {
			redeem = v
		}

		if addr != "" && redeem != "" {
			return &HTLCContract{P2SHAddress: addr, RedeemScript: redeem}, nil
		}
		// fall through to try direct flat decode
	}

	// 2) Try flat object schema
	var flat map[string]any
	if err := json.Unmarshal(b, &flat); err == nil {
		addr, _ := flat["address"].(string)
		// allow both keys
		redeem, _ := flat["redeem_script"].(string)
		if redeem == "" {
			if v, ok := flat["redeemScript"].(string); ok {
				redeem = v
			}
		}
		if addr != "" && redeem != "" {
			return &HTLCContract{P2SHAddress: addr, RedeemScript: redeem}, nil
		}
	}

	return nil, fmt.Errorf("address-test.json does not contain a recognizable HTLC record")
}

// ---------- main ----------
func main() {
	fmt.Println("Funding HTLC (regtest)...")

	amount, err := readPaymentAmount()
	if err != nil {
		fmt.Println("Fatal:", err)
		os.Exit(1)
	}
	htlc, err := readHTLC()
	if err != nil {
		fmt.Println("Fatal:", err)
		os.Exit(1)
	}

	fmt.Printf("Destination: %s\n", htlc.P2SHAddress)
	fmt.Printf("Amount     : %.8f BTC\n", amount)

	// Use wallet RPC: sendtoaddress <address> <amount> "" "" subtractfeefromamount=true
	var txid string
	err = callRPC("sendtoaddress", []interface{}{htlc.P2SHAddress, amount, "", "", true}, &txid)
	if err != nil {
		fmt.Println("sendtoaddress failed:", err)
		os.Exit(1)
	}
	fmt.Println("Broadcast txid:", txid)

	// Optional: mine blocks to confirm (regtest only)
	// get a fresh address to mine to, then generatetoaddress 1
	var minerAddr string
	if err := callRPC("getnewaddress", []interface{}{}, &minerAddr); err == nil && minerAddr != "" {
		var mined []string
		if err := callRPC("generatetoaddress", []interface{}{1, minerAddr}, &mined); err == nil {
			fmt.Println("Mined 1 block for confirmation:", mined)
		} else {
			fmt.Println("Skip mining:", err)
		}
	} else {
		fmt.Println("No mining address; skip mining:", err)
	}

	fmt.Println("HTLC funding complete.")
}
