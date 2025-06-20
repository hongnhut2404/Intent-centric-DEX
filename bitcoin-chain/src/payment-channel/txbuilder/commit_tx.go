// === txbuilder/commit_tx.go ===
package txbuilder

import "fmt"

func CreateCommitmentTx(statePath string) {
	fmt.Println("Construct commitment transaction here (off-chain)")
}

func BroadcastCommitmentTx(statePath string) {
	fmt.Println("Broadcast commitment tx to settle the channel")
}
