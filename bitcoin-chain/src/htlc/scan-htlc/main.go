// bitcoin-chain/src/htlc/scan-htlc/main.go
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
)

// Reuse your callRPC(method string, params []interface{}) (json.RawMessage, error)

const dataDir = "../../../data-script"

type scanUTXO struct {
	Txid         string  `json:"txid"`
	Vout         int     `json:"vout"`
	ScriptPubKey string  `json:"scriptPubKey"`
	Amount       float64 `json:"amount"`
	Height       *int64  `json:"height,omitempty"` // regtest may omit height
}

type scanResult struct {
	Success     bool       `json:"success"`
	Unspents    []scanUTXO `json:"unspents"`
	TotalAmount float64    `json:"total_amount"`
}

func readHTLCAddress() (string, error) {
	addrFile := filepath.Join(dataDir, "address-test.json")
	raw, err := ioutil.ReadFile(addrFile)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", addrFile, err)
	}

	// Your file shape:
	// {
	//   "HTLC": [
	//     { "address": "...", "redeemScript": "..." }
	//   ]
	// }
	var blob struct {
		HTLC []struct {
			Address      string `json:"address"`
			RedeemScript string `json:"redeemScript"`
		} `json:"HTLC"`
	}
	if err := json.Unmarshal(raw, &blob); err != nil {
		return "", fmt.Errorf("decode %s: %w", addrFile, err)
	}
	if len(blob.HTLC) == 0 || blob.HTLC[0].Address == "" {
		return "", fmt.Errorf("%s has no HTLC[0].address", addrFile)
	}
	return blob.HTLC[0].Address, nil
}

func writePrettyJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, b, 0644)
}

func scanHTLC() error {
	htlcAddr, err := readHTLCAddress()
	if err != nil {
		return err
	}
	log.Printf("Scanning UTXOs for HTLC address: %s\n", htlcAddr)

	// scantxoutset "start" ["addr(<htlcAddr>)"]
	params := []interface{}{"start", []interface{}{fmt.Sprintf("addr(%s)", htlcAddr)}}
	raw, err := callRPC("scantxoutset", params)
	if err != nil {
		return fmt.Errorf("scantxoutset failed: %w", err)
	}

	var sr scanResult
	if err := json.Unmarshal(raw, &sr); err != nil {
		return fmt.Errorf("decode scantxoutset result: %w", err)
	}

	outPath := filepath.Join(dataDir, "utxo-htlc.json")
	if err := writePrettyJSON(outPath, sr); err != nil {
		return fmt.Errorf("write %s: %w", outPath, err)
	}

	log.Printf("Found %d UTXO(s), total %.8f BTC. Saved to %s\n", len(sr.Unspents), sr.TotalAmount, outPath)
	return nil
}

func main() {
	if err := scanHTLC(); err != nil {
		log.Println("Error:", err)
		os.Exit(1)
	}
}
