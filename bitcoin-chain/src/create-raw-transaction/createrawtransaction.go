package main

import (
	"encoding/json"
	"fmt"
)

type TxInput struct {
	TxID     string `json:"txid"`
	Vout     int    `json:"vout"`
	Sequence *int   `json:"sequence,omitempty"` // Optional
}

type TxOutput struct {
	Address string  // Either a BTC address or "data"
	Amount  float64 // Use 0 for data output
	Data    *string // Optional hex string for OP_RETURN
}

func CreateRawTransaction(inputs []TxInput, outputs []TxOutput, locktime *int, replaceable *bool) (string, error) {
	var formattedInputs []map[string]interface{}
	for _, in := range inputs {
		input := map[string]interface{}{
			"txid": in.TxID,
			"vout": in.Vout,
		}
		if in.Sequence != nil {
			input["sequence"] = *in.Sequence
		}
		formattedInputs = append(formattedInputs, input)
	}

	var formattedOutputs []map[string]interface{}
	for _, out := range outputs {
		if out.Data != nil {
			formattedOutputs = append(formattedOutputs, map[string]interface{}{
				"data": *out.Data,
			})
		} else {
			formattedOutputs = append(formattedOutputs, map[string]interface{}{
				out.Address: out.Amount,
			})
		}
	}

	params := []interface{}{formattedInputs, formattedOutputs}

	if locktime != nil {
		params = append(params, *locktime)
	}
	if replaceable != nil {
		params = append(params, *replaceable)
	}

	raw, err := callRPC("createrawtransaction", params)
	if err != nil {
		return "", err
	}

	var hex string
	if err := json.Unmarshal(raw, &hex); err != nil {
		return "", fmt.Errorf("decode error: %w", err)
	}
	return hex, nil
}
