package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"example.com/m/keys"
	"example.com/m/scripts"
	"example.com/m/txbuilder"
	"github.com/joho/godotenv"
)

func loadEnv() {
	paths := []string{"../../.env", "../.env", "./.env"} // flexible search
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from known locations")
}

func main() {
	loadEnv()

	statePath := os.Getenv("STATE_PATH")
	paymentMessagePath := os.Getenv("PAYMENT_MESSAGE")
	opreturnTxPath := os.Getenv("OPRETURN_TX")

	if statePath == "" || paymentMessagePath == "" || opreturnTxPath == "" {
		log.Fatal("Missing environment variables: STATE_PATH, PAYMENT_MESSAGE, or OPRETURN_TX")
	}

	if len(os.Args) < 2 {
		fmt.Println("Usage:")
		fmt.Println("  go run main.go [init|fund|multisig|htlc|commit|sign|settle|refund]")
		return
	}

	switch os.Args[1] {
	case "init":
		if len(os.Args) < 3 {
			fmt.Println("Usage: go run main.go init <alice|bob>")
			return
		}
		keys.GenerateAndStoreKeys(statePath, os.Args[2])

	case "fund":
		txbuilder.FundChannel(statePath)

	case "multisig":
		_, _, err := scripts.GenerateMultisig(statePath)
		if err != nil {
			fmt.Println("Multisig error:", err)
		}

	case "htlc":
		if len(os.Args) < 4 {
			fmt.Println("Usage: go run main.go htlc <sha256(secret)> <timelock>")
			return
		}
		_, _, err := scripts.GenerateHTLCScript(statePath, os.Args[2], parseInt64(os.Args[3]))
		if err != nil {
			fmt.Println("HTLC error:", err)
		}

	case "commit":
		if len(os.Args) < 4 {
			fmt.Println("Usage: go run main.go commit <aliceAmount> <bobAmount>")
			return
		}
		var a, b float64
		fmt.Sscanf(os.Args[2], "%f", &a)
		fmt.Sscanf(os.Args[3], "%f", &b)
		if err := txbuilder.CreateCommitmentTx(statePath, a, b); err != nil {
			fmt.Println("Commitment Tx error:", err)
		}

	case "sign":
		if err := txbuilder.SignCommitmentTx(statePath); err != nil {
			fmt.Println("Sign error:", err)
		}

	case "settle":
		b, err := os.ReadFile("data/commit-signed.txt")
		if err != nil {
			fmt.Println("Missing signed tx file:", err)
			return
		}
		fmt.Println("Use bitcoin-cli to send this tx:")
		fmt.Println("bitcoin-cli sendrawtransaction", string(b))

	case "refund":
		if err := txbuilder.RefundTransaction(statePath); err != nil {
			fmt.Println("Refund error:", err)
		}

	case "generate-message":
		exchangePath := os.Getenv("EXCHANGE_DATA")
		if exchangePath == "" {
			fmt.Println("EXCHANGE_DATA not set in .env")
			return
		}

		raw, err := os.ReadFile(exchangePath)
		if err != nil {
			fmt.Println("Failed to read exchange-data.json:", err)
			return
		}

		// New schema with back-compat to old field names
		var exchange struct {
			Success    bool   `json:"success"`
			BuyIntent  int    `json:"buyIntentId"`
			BaseSecret string `json:"baseSecret"` // NEW (preferred)
			HTLCs      []struct {
				// legacy name kept for back-compat; not used if BaseSecret present
				SecretBase string  `json:"secretBase,omitempty"`
				BtcAmount  float64 `json:"btcAmount"`
			} `json:"htlcs"`
		}

		if err := json.Unmarshal(raw, &exchange); err != nil {
			fmt.Println("Invalid JSON in exchange-data.json:", err)
			return
		}
		if len(exchange.HTLCs) == 0 {
			fmt.Println("No HTLCs found in exchange data")
			return
		}

		// Resolve the shared secret (prefer new top-level baseSecret)
		secret := exchange.BaseSecret
		if secret == "" && exchange.HTLCs[0].SecretBase != "" { // fallback to legacy location
			secret = exchange.HTLCs[0].SecretBase
		}
		if secret == "" {
			fmt.Println("No shared secret found (expected top-level baseSecret or htlcs[0].secretBase)")
			return
		}

		// Sum all BTC amounts
		var totalBTC float64
		for _, h := range exchange.HTLCs {
			totalBTC += h.BtcAmount
		}
		if totalBTC <= 0 {
			fmt.Println("Total BTC amount is zero or negative")
			return
		}

		btcAmountStr := fmt.Sprintf("%.8f", totalBTC)

		if err := scripts.GeneratePaymentMessage(secret, btcAmountStr, paymentMessagePath, opreturnTxPath, statePath); err != nil {
			fmt.Println("Generate error:", err)
			return
		}
		fmt.Println("Payment message + OP_RETURN generated successfully")

	case "verify-opreturn":
		if len(os.Args) != 4 {
			fmt.Println("Usage: go run main.go verify-opreturn <payment_message.json> <payment_opreturn.txt>")
			return
		}
		msg, err := scripts.ExtractOpReturnMessage(os.Args[3])
		if err != nil {
			fmt.Println("Failed to extract OP_RETURN:", err)
			return
		}
		fmt.Println("Extracted OP_RETURN message:", msg)
		if err := scripts.VerifyPaymentMessageWithExtracted(msg, os.Args[2], statePath); err != nil {
			fmt.Println("Signature or content mismatch:", err)
		} else {
			fmt.Println("Signature and OP_RETURN match verified.")
		}
	}
}

func parseInt64(s string) int64 {
	var i int64
	fmt.Sscanf(s, "%d", &i)
	return i
}
