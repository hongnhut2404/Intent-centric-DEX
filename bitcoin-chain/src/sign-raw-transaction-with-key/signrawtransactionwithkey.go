package main

import (
	"encoding/json"
	"fmt"
)

type PrevTx struct {
	Txid          string  `json:"txid"`
	Vout          int     `json:"vout"`
	ScriptPubKey  string  `json:"scriptPubKey"`
	RedeemScript  string  `json:"redeemScript,omitempty"`
	WitnessScript string  `json:"witnessScript,omitempty"`
	Amount        float64 `json:"amount"`
}

type SignRawTransactionResult struct {
	Hex      string `json:"hex"`
	Complete bool   `json:"complete"`
}

func SignRawTransactionWithKey(rawTxHex string, privKeys []string, prevTxs []PrevTx, sighashType string) (string, error) {
	// Debug: print the inputs
	// fmt.Println("Raw Transaction:", rawTxHex)
	// fmt.Println("Private Keys:", privKeys)
	// fmt.Println("Previous Transactions:", prevTxs)

	params := []interface{}{rawTxHex, privKeys}

	// Add previous outputs if any
	if len(prevTxs) > 0 {
		params = append(params, prevTxs)
	} else {
		params = append(params, nil)
	}

	// Add sighash type if provided
	if sighashType != "" {
		params = append(params, sighashType)
	}

	result, err := callRPC("signrawtransactionwithkey", params)
	if err != nil {
		return "", err
	}

	var signResult SignRawTransactionResult
	if err := json.Unmarshal(result, &signResult); err != nil {
		return "", fmt.Errorf("failed to unmarshal sign result: %w", err)
	}

	if !signResult.Complete {
		return "", fmt.Errorf("transaction signing incomplete")
	}

	return signResult.Hex, nil
}
