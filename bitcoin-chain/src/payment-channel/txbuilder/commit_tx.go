package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

func CreateCommitmentTx(stateFile string, aliceBalance float64, bobBalance float64) error {
	// read current state
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("cannot read state file: %v", err)
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("invalid JSON: %v", err)
	}

	// update channel balances
	if state.Channel == nil {
		return fmt.Errorf("channel is not initialized")
	}
	state.Channel.AliceBalance = aliceBalance
	state.Channel.BobBalance = bobBalance

	fmt.Printf("Set ChannelState: Alice=%.8f BTC, Bob=%.8f BTC\n", aliceBalance, bobBalance)

	// amounts
	totalAmount := int64(state.HTLC.Amount * 1e8)
	fee := int64(500)

	aliceAmountSat := int64(aliceBalance * 1e8)
	bobAmountSat := int64(bobBalance*1e8) - fee

	if aliceAmountSat+bobAmountSat+fee != totalAmount {
		return fmt.Errorf("alice + bob + fee mismatch with HTLC amount")
	}

	// build commitment tx
	tx := wire.NewMsgTx(wire.TxVersion)

	// input (from HTLC UTXO)
	hash, err := chainhash.NewHashFromStr(state.HTLC.Txid)
	if err != nil {
		return fmt.Errorf("invalid HTLC txid: %v", err)
	}
	txIn := wire.NewTxIn(wire.NewOutPoint(hash, state.HTLC.Vout), nil, nil)
	tx.AddTxIn(txIn)

	// Bob output
	bobAddr, _ := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	bobScript, _ := txscript.PayToAddrScript(bobAddr)
	tx.AddTxOut(wire.NewTxOut(bobAmountSat, bobScript))

	// Alice output
	aliceAddr, _ := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	aliceScript, _ := txscript.PayToAddrScript(aliceAddr)
	tx.AddTxOut(wire.NewTxOut(aliceAmountSat, aliceScript))

	// OP_RETURN with latest balances
	opReturnData := fmt.Sprintf("alice:%.8f,bob:%.8f", aliceBalance, bobBalance)
	opReturnScript, err := txscript.NullDataScript([]byte(opReturnData))
	if err != nil {
		return fmt.Errorf("failed to build OP_RETURN script: %v", err)
	}
	tx.AddTxOut(wire.NewTxOut(0, opReturnScript))

	// serialize
	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return fmt.Errorf("tx serialization failed: %v", err)
	}
	rawTx := hex.EncodeToString(buf.Bytes())

	fmt.Println("Unsigned Commitment Transaction (hex):", rawTx)

	// store to file for signing
	if err := os.WriteFile("data/commit-unsigned.txt", []byte(rawTx), 0644); err != nil {
		return fmt.Errorf("failed to write commit tx: %v", err)
	}

	// update state with *latest* commitment only
	state.Commitments = []Commitment{{
		ID:           1,
		AliceBalance: aliceBalance,
		BobBalance:   bobBalance,
		SignedTx:     rawTx,
		Timestamp:    time.Now().Format(time.RFC3339),
	}}
	updated, _ := json.MarshalIndent(state, "", "  ")
	_ = os.WriteFile(stateFile, updated, 0644)

	fmt.Println("✅ Stored latest commitment with OP_RETURN attached")

	return nil
}
