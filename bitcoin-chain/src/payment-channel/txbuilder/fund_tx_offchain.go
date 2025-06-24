package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type UTXOFile struct {
	Unspents []BobUTXO `json:"unspents"`
}

func FundMultisigFromBobOffchain(statePath string) error {
	// Load fund destination
	fundRaw, err := os.ReadFile("data/fund.json")
	if err != nil {
		return fmt.Errorf("failed to read fund.json: %v", err)
	}
	var fund FundData
	if err := json.Unmarshal(fundRaw, &fund); err != nil {
		return fmt.Errorf("invalid fund.json: %v", err)
	}

	// Load Bob's key
	stateRaw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state.json: %v", err)
	}
	var state State
	if err := json.Unmarshal(stateRaw, &state); err != nil {
		return fmt.Errorf("failed to parse state.json: %v", err)
	}
	privBytes, _ := hex.DecodeString(state.Bob.PrivKey)
	privKey, _ := btcec.PrivKeyFromBytes(privBytes)

	// Load Bob's UTXO
	utxoRaw, err := os.ReadFile("data/bob-utxo.json")
	if err != nil {
		return fmt.Errorf("missing bob-utxo.json: %v", err)
	}
	var file UTXOFile
	if err := json.Unmarshal(utxoRaw, &file); err != nil {
		return fmt.Errorf("invalid utxo: %v", err)
	}
	if len(file.Unspents) == 0 {
		return fmt.Errorf("no unspents found")
	}
	utxo := file.Unspents[0]
	fmt.Println(utxo.Amount)
	fmt.Println(fund.Amount)
	amountIn := int64(utxo.Amount * 1e8)
	amountOut := int64(fund.Amount * 1e8)
	fee := int64(500) // fixed fee

	if amountIn < amountOut+fee {
		return fmt.Errorf("insufficient balance (need %d, have %d)", amountOut+fee, amountIn)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	txHash, _ := chainhash.NewHashFromStr(utxo.Txid)
	outPoint := wire.NewOutPoint(txHash, utxo.Vout)
	txIn := wire.NewTxIn(outPoint, nil, nil)
	tx.AddTxIn(txIn)

	// Output to multisig
	addr, err := btcutil.DecodeAddress(fund.Address, &chaincfg.RegressionNetParams)
	if err != nil {
		return fmt.Errorf("invalid multisig address: %v", err)
	}
	script, err := txscript.PayToAddrScript(addr)
	if err != nil {
		return fmt.Errorf("failed to create output script: %v", err)
	}
	txOut := wire.NewTxOut(amountOut, script)
	tx.AddTxOut(txOut)

	// Change back to Bob
	changeAddr, _ := btcutil.DecodeAddress(state.Bob.Address, &chaincfg.RegressionNetParams)
	changeScript, _ := txscript.PayToAddrScript(changeAddr)
	tx.AddTxOut(wire.NewTxOut(amountIn-amountOut-fee, changeScript))

	scriptPubKey, _ := hex.DecodeString(utxo.ScriptPubKey)
	sigScript, err := txscript.SignatureScript(
		tx, 0, scriptPubKey, txscript.SigHashAll, privKey, true,
	)
	if err != nil {
		return fmt.Errorf("signing error: %v", err)
	}
	tx.TxIn[0].SignatureScript = sigScript

	// Serialize transaction (do NOT broadcast)
	var buf bytes.Buffer
	tx.Serialize(&buf)
	txHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("\n📝 Signed raw funding transaction (off-chain):")
	fmt.Println(txHex)
	_ = os.WriteFile("data/funding-tx-hex.txt", []byte(txHex), 0644)
	return nil
}
