package txbuilder

import (
	"encoding/json"
	"fmt"
	"os"
)

func UpdateHTLCTx(stateFile string, txid string, vout uint32) error {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("failed to read state.json: %v", err)
	}

	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("failed to parse state.json: %v", err)
	}

	if state.HTLC == nil {
		state.HTLC = &HTLC{}
	}

	state.HTLC.Txid = txid
	state.HTLC.Vout = vout

	updated, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated state.json: %v", err)
	}
	if err := os.WriteFile(stateFile, updated, 0644); err != nil {
		return fmt.Errorf("failed to write updated state.json: %v", err)
	}

	fmt.Printf("Updated state.json with HTLC txid=%s, vout=%d\n", txid, vout)
	return nil
}

func UpdateHTLCAmount(stateFile string, amount float64) error {
	// Load existing state
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("failed to read state.json: %v", err)
	}

	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("failed to parse state.json: %v", err)
	}

	// initialize HTLC if missing
	if state.HTLC == nil {
		state.HTLC = &HTLC{}
	}

	// store the amount
	state.HTLC.Amount = amount

	// write back
	updated, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated state.json: %v", err)
	}
	if err := os.WriteFile(stateFile, updated, 0644); err != nil {
		return fmt.Errorf("failed to write updated state.json: %v", err)
	}

	fmt.Printf("Updated state.json with HTLC amount: %.8f BTC\n", amount)
	return nil
}

func UpdateFund(amount float64) error {
	// Load fund destination
	fundRaw, err := os.ReadFile("data/fund.json")
	if err != nil {
		return fmt.Errorf("failed to read fund.json: %v", err)
	}
	var fund FundData
	if err := json.Unmarshal(fundRaw, &fund); err != nil {
		return fmt.Errorf("invalid fund.json: %v", err)
	}

	// Override amount with input parameter
	fund.Amount = amount

	// Optionally store it back to fund.json
	fundBytes, err := json.MarshalIndent(fund, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated fund.json: %v", err)
	}
	if err := os.WriteFile("data/fund.json", fundBytes, 0644); err != nil {
		return fmt.Errorf("failed to update fund.json: %v", err)
	}
	fmt.Println("Updated fund.json with amount:", amount)
	return nil
}
