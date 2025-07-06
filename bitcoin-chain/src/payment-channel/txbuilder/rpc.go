package txbuilder

import (
	"encoding/json"
	"fmt"
)

func GetBobUTXOFromScantxoutset(bobAddress string) (*ScanTxOutResult, error) {
	scanArgs := []interface{}{
		"start",
		[]interface{}{
			fmt.Sprintf("addr(%s)", bobAddress),
		},
	}

	rawResp, err := callRPC("scantxoutset", scanArgs)
	if err != nil {
		return nil, fmt.Errorf("scantxoutset failed: %w", err)
	}

	var result ScanTxOutResult
	if err := json.Unmarshal(rawResp, &result); err != nil {
		return nil, fmt.Errorf("failed to decode scantxoutset result: %w", err)
	}

	if len(result.Unspents) == 0 {
		return nil, fmt.Errorf("no UTXO found for Bob")
	}

	return &result, nil
}
