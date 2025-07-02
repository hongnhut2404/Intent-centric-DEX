package txbuilder

import (
	"encoding/json"
	"fmt"
	"os"

	"example.com/m/utils"
)

func FundChannel(statePath string) {
	// Load funding data
	raw, err := os.ReadFile("data/fund.json")
	if err != nil {
		panic(fmt.Errorf("failed to read fund.json: %v", err))
	}
	var input FundInput
	if err := json.Unmarshal(raw, &input); err != nil {
		panic(fmt.Errorf("invalid fund.json format: %v", err))
	}

	// Load RPC credentials (or put in .env)
	rpcURL := "http://127.0.0.1:8332"
	rpcUser := "admin"
	rpcPass := "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"

	// Send BTC
	txid, vout, err := utils.SendToAddressWithDetails(rpcURL, rpcUser, rpcPass, input.Address, input.Amount)
	if err != nil {
		fmt.Println("Funding failed:", err)
		return
	}

	fmt.Println("Funding success!")
	fmt.Println("TxID:", txid)
	fmt.Println("Vout:", vout)

	// Store UTXO info for later use (in commitment/refund tx)
	utxo := UTXORecord{
		TxID:   txid,
		Vout:   vout,
		Amount: input.Amount,
	}
	utxoBytes, _ := json.MarshalIndent(utxo, "", "  ")
	_ = os.WriteFile(statePath, utxoBytes, 0644)
}
