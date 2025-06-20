package txbuilder

import (
	"encoding/json"
	"fmt"
	"os"

	"example.com/m/utils"
)

func FundChannel(statePath string) {
	raw, err := os.ReadFile(statePath)
	if err != nil {
		panic(err)
	}

	var state struct {
		Privkey string `json:"privkey"`
	}
	if err := json.Unmarshal(raw, &state); err != nil {
		panic(err)
	}

	// Hardcoded regtest RPC credentials (customize this)
	rpcURL := "http://127.0.0.1:8332"
	rpcUser := "admin"
	rpcPass := "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"

	// Use the address printed from init
	address := "mqkNsKDBoKWus1pQ9ortCDacMjAu2JfiHD"
	amount := 0.01

	if err := utils.SendToAddress(rpcURL, rpcUser, rpcPass, address, amount); err != nil {
		fmt.Println("Funding failed:", err)
		return
	}
	fmt.Println("Funding successful")
}
