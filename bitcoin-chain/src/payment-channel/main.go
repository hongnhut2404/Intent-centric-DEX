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

		exchangeDataRaw, err := os.ReadFile(exchangePath)
		if err != nil {
			fmt.Println("Failed to read exchange-data.json:", err)
			return
		}

		var exchangeData struct {
			Success bool `json:"success"`
			HTLCs   []struct {
				Secret    string  `json:"secretBase"`
				BtcAmount float64 `json:"btcAmount"`
			} `json:"htlcs"`
		}

		if err := json.Unmarshal(exchangeDataRaw, &exchangeData); err != nil {
			fmt.Println("Invalid JSON in exchange-data.json:", err)
			return
		}
		if len(exchangeData.HTLCs) == 0 {
			fmt.Println("No HTLCs found in exchange data")
			return
		}

		// Get the shared secret (assumed same for all HTLCs)
		secret := exchangeData.HTLCs[0].Secret

		// Sum up all BTC amounts
		var totalBTC float64
		for _, htlc := range exchangeData.HTLCs {
			totalBTC += htlc.BtcAmount
		}

		btcAmountStr := fmt.Sprintf("%.8f", totalBTC)

		err = scripts.GeneratePaymentMessage(secret, btcAmountStr, paymentMessagePath, opreturnTxPath, statePath)
		if err != nil {
			fmt.Println("Generate error:", err)
		}

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
