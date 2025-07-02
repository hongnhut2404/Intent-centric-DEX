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

	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("cannot read state file: %v", err)
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("invalid JSON: %v", err)
	}

	err = SetChannelBalances(&state, aliceBalance, bobBalance)
	if err != nil {
		return fmt.Errorf("failed to set balances: %v", err)
	}

	// check HTLC
	totalAmount := int64(state.HTLC.Amount * 1e8)
	fee := int64(500)

	aliceAmountSat := int64(state.Channel.AliceBalance * 1e8)
	bobAmountSat := int64(state.Channel.BobBalance*1e8) - fee

	if aliceAmountSat+bobAmountSat+fee != totalAmount {
		return fmt.Errorf("channel balances plus fee do not match HTLC amount")
	}

	state.Channel.BobBalance = float64(bobAmountSat) / 1e8

	// build tx
	tx := wire.NewMsgTx(wire.TxVersion)
	hash, _ := chainhash.NewHashFromStr(state.HTLC.Txid)
	txIn := wire.NewTxIn(wire.NewOutPoint(hash, state.HTLC.Vout), nil, nil)
	tx.AddTxIn(txIn)

	bobAddr, _ := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	bobScript, _ := txscript.PayToAddrScript(bobAddr)
	tx.AddTxOut(wire.NewTxOut(bobAmountSat, bobScript))

	aliceAddr, _ := btcutil.DecodeAddress(state.Alice.Address, &chaincfg.RegressionNetParams)
	aliceScript, _ := txscript.PayToAddrScript(aliceAddr)
	tx.AddTxOut(wire.NewTxOut(aliceAmountSat, aliceScript))

	// serialize
	var buf bytes.Buffer
	tx.Serialize(&buf)
	rawTx := hex.EncodeToString(buf.Bytes())
	fmt.Println("Unsigned Commitment Transaction (hex):", rawTx)
	os.WriteFile("data/commit-unsigned.txt", []byte(rawTx), 0644)

	// store commitment
	newCommitment := Commitment{
		ID:           len(state.Commitments) + 1,
		AliceBalance: state.Channel.AliceBalance,
		BobBalance:   state.Channel.BobBalance,
		SignedTx:     rawTx,
		Timestamp:    time.Now().Format(time.RFC3339),
	}
	state.Commitments = append(state.Commitments, newCommitment)

	updated, _ := json.MarshalIndent(state, "", "  ")
	os.WriteFile(stateFile, updated, 0644)

	fmt.Println("Stored commitment ID", newCommitment.ID)

	return nil
}

func SetChannelBalances(state *State, aliceAmount float64, bobAmount float64) error {
	if state.Channel == nil {
		return fmt.Errorf("channel state is not initialized")
	}

	state.Channel.AliceBalance = aliceAmount
	state.Channel.BobBalance = bobAmount

	fmt.Printf("Set ChannelState balances: Alice=%.8f BTC, Bob=%.8f BTC\n", aliceAmount, bobAmount)
	return nil
}
