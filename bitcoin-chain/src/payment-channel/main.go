package main

import (
	"fmt"
	"os"

	"example.com/m/keys"
	"example.com/m/scripts"
	"example.com/m/txbuilder"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage:")
		fmt.Println("  go run main.go [init|fund|multisig|htlc|commit|sign|settle|refund]")
		fmt.Println()
		fmt.Println("Commands:")
		fmt.Println("  init <alice|bob>               Generate keypair and store in state.json")
		fmt.Println("  fund                           Fund the HTLC address (read from fund.json)")
		fmt.Println("  multisig                       Generate 2-of-2 multisig and P2SH address")
		fmt.Println("  htlc <sha256(secret)> <locktime>   Generate HTLC P2SH script and address")
		fmt.Println("  commit                         Build unsigned commitment tx for Alice")
		fmt.Println("  sign <secret>                  Sign the commitment tx with secret (preimage)")
		fmt.Println("  settle                         Alias for broadcasting signed commitment tx")
		fmt.Println("  refund                         Build refund tx for Bob (after timeout)")
		return
	}

	cmd := os.Args[1]

	switch cmd {
	case "init":
		if len(os.Args) < 3 {
			fmt.Println("Usage: go run main.go init <alice|bob>")
			return
		}
		role := os.Args[2]
		keys.GenerateAndStoreKeys("data/state.json", role)

	case "fund":
		txbuilder.FundChannel("data/state.json")

	case "multisig":
		_, _, err := scripts.GenerateMultisig("data/state.json")
		if err != nil {
			fmt.Println("Multisig error:", err)
		}

	case "htlc":
		if len(os.Args) < 4 {
			fmt.Println("Usage: go run main.go htlc <sha256(secret)> <timelock>")
			return
		}
		hashlock := os.Args[2]
		timelock := os.Args[3] // pass as string, parse inside the function
		_, _, err := scripts.GenerateHTLCScript("data/state.json", hashlock, parseInt64(timelock))
		if err != nil {
			fmt.Println("HTLC error:", err)
		}

	case "commit":
		err := txbuilder.CreateCommitmentTx("data/state.json")
		if err != nil {
			fmt.Println("Commitment Tx error:", err)
		}

	case "sign":
		if len(os.Args) < 3 {
			fmt.Println("Usage: go run main.go sign <secret>")
			return
		}
		preimage := os.Args[2]
		err := txbuilder.SignCommitmentTx("data/state.json", preimage)
		if err != nil {
			fmt.Println("Sign error:", err)
		}

	case "settle":
		// Shortcut: read commit-signed.txt and broadcast manually
		signed, err := os.ReadFile("data/commit-signed.txt")
		if err != nil {
			fmt.Println("Missing signed tx file:", err)
			return
		}
		fmt.Println("Use bitcoin-cli to send this tx:")
		fmt.Println("bitcoin-cli sendrawtransaction", string(signed))

	case "refund":
		err := txbuilder.RefundTransaction("data/state.json")
		if err != nil {
			fmt.Println("Refund error:", err)
		}

	default:
		fmt.Println("Unknown command:", cmd)
	}
}

func parseInt64(s string) int64 {
	var val int64
	fmt.Sscanf(s, "%d", &val)
	return val
}
