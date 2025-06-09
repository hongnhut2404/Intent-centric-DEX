package main

import (
	"encoding/json"
	"fmt"
)

// SendRawTransaction submits a signed transaction to the Bitcoin network.
func SendRawTransaction(signedTxHex string, maxFeeRate float64) (string, error) {
	// If maxFeeRate is zero, omit it to use default
	var params []interface{}
	if maxFeeRate > 0 {
		params = []interface{}{signedTxHex, fmt.Sprintf("%.8f", maxFeeRate)}
	} else {
		params = []interface{}{signedTxHex}
	}

	// Call the RPC method
	raw, err := callRPC("sendrawtransaction", params)
	if err != nil {
		return "", err
	}

	var txID string
	if err := json.Unmarshal(raw, &txID); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}
	return txID, nil
}
