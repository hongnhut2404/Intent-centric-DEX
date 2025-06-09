package main

import (
	"fmt"
	"log"
)

func main() {
	params := ListTransactionsParams{
		// Leave any of these unset and they’ll default:
		// Label: "*",
		// Count: 20,
		// Skip: 0,
		// IncludeWatchOnly: BoolPtr(true),
	}

	txs, err := ListTransactions(params)
	if err != nil {
		log.Fatalf("ListTransactions failed: %v", err)
	}

	for i, tx := range txs {
		fmt.Printf("\nTransaction #%d:\n", i+1)
		fmt.Printf("  Address: %s\n", tx.Address)
		fmt.Printf("  Category: %s\n", tx.Category)
		fmt.Printf("  Amount: %.8f BTC\n", tx.Amount)
		fmt.Printf("  Label: %s\n", tx.Label)
		fmt.Printf("  Vout: %d\n", tx.Vout)
		fmt.Printf("  Abandoned: %v\n", tx.Abandoned)
		fmt.Printf("  Confirmations: %d\n", tx.Confirmations)
		fmt.Printf("  Generated: %v\n", tx.Generated)
		fmt.Printf("  Block Hash: %s\n", tx.BlockHash)
		fmt.Printf("  Block Height: %d\n", tx.BlockHeight)
		fmt.Printf("  Block Index: %d\n", tx.BlockIndex)
		fmt.Printf("  Block Time: %d\n", tx.BlockTime)
		fmt.Printf("  TxID: %s\n", tx.TxID)
		fmt.Printf("  WtxID: %s\n", tx.WtxID)
		fmt.Printf("  Time: %d\n", tx.Time)
		fmt.Printf("  Time Received: %d\n", tx.TimeReceived)
		fmt.Printf("  BIP125 Replaceable: %s\n", tx.BIP125Replaceable)

		if len(tx.ParentDescs) > 0 {
			fmt.Println("  Parent Descs:")
			for _, desc := range tx.ParentDescs {
				fmt.Printf("    - %s\n", desc)
			}
		}

		if len(tx.WalletConflicts) > 0 {
			fmt.Println("  Wallet Conflicts:")
			for _, conflict := range tx.WalletConflicts {
				fmt.Printf("    - %s\n", conflict)
			}
		}
	}
}

// Optional helper
func BoolPtr(b bool) *bool {
	return &b
}
