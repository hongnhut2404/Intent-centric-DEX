// === main.go ===
package main

import (
	"fmt"
	"os"

	"example.com/m/keys"
	"example.com/m/txbuilder"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go [init|fund|commit|settle|refund]")
		return
	}

	switch os.Args[1] {
	case "init":
		keys.GenerateAndStoreKeys("data/state.json")
	case "fund":
		txbuilder.FundChannel("data/state.json")
	case "commit":
		txbuilder.CreateCommitmentTx("data/state.json")
	case "settle":
		txbuilder.BroadcastCommitmentTx("data/state.json")
	case "refund":
		txbuilder.RefundTransaction("data/state.json")
	default:
		fmt.Println("Unknown command")
	}
}
