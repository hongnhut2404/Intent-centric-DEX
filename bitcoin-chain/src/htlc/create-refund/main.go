package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/rpcclient"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/joho/godotenv"
)

func loadEnv() {
	paths := []string{"../../.env", "../.env", "./.env", "../../../.env"}
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from any known location")
}

func main() {
	loadEnv()

	// Load environment variables
	utxoPath := os.Getenv("UTXO_HTLC_JSON")
	addressPath := os.Getenv("ADDRESS_TEST")
	statePath := os.Getenv("STATE_PATH_HTLC")

	// Load HTLC redeemScript
	addrRaw, _ := ioutil.ReadFile(addressPath)
	var addrData map[string][]map[string]string
	_ = json.Unmarshal(addrRaw, &addrData)
	redeemHex := addrData["HTLC"][0]["redeemScript"]
	redeemScript, _ := hex.DecodeString(redeemHex)

	// Load UTXO data
	utxoRaw, _ := ioutil.ReadFile(utxoPath)
	var utxoData map[string]interface{}
	_ = json.Unmarshal(utxoRaw, &utxoData)
	utxo := utxoData["unspents"].([]interface{})[0].(map[string]interface{})
	txidStr := utxo["txid"].(string)
	vout := uint32(utxo["vout"].(float64))
	amount := btcutil.Amount(utxo["amount"].(float64) * 1e8)

	// Load sender key and address
	stateRaw, _ := ioutil.ReadFile(statePath)
	var state map[string]interface{}
	_ = json.Unmarshal(stateRaw, &state)
	sender := state["alice"].(map[string]interface{})
	privHex := sender["privkey"].(string)
	privKey, _ := btcec.PrivKeyFromBytes(hexDecode(privHex))
	address, _ := btcutil.DecodeAddress(sender["address"].(string), &chaincfg.RegressionNetParams)
	pkScript, _ := txscript.PayToAddrScript(address)

	// Build transaction
	tx := wire.NewMsgTx(wire.TxVersion)
	txHash, _ := chainhash.NewHashFromStr(txidStr)
	txIn := wire.NewTxIn(wire.NewOutPoint(txHash, vout), nil, nil)
	txIn.Sequence = 0 // For locktime to be respected
	tx.TxIn = append(tx.TxIn, txIn)

	fee := btcutil.Amount(500)
	refundAmount := int64(amount - fee)
	txOut := wire.NewTxOut(refundAmount, pkScript)
	tx.TxOut = append(tx.TxOut, txOut)

	// Set locktime
	tx.LockTime = 300

	// Generate signature
	sig, _ := txscript.RawTxInSignature(tx, 0, redeemScript, txscript.SigHashAll, privKey)
	builder := txscript.NewScriptBuilder()
	builder.AddData(sig)
	builder.AddInt64(0) // No preimage for refund
	builder.AddData(redeemScript)
	sigScript, _ := builder.Script()
	tx.TxIn[0].SignatureScript = sigScript

	// Serialize and broadcast
	var buf bytes.Buffer
	tx.Serialize(&buf)
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Refund Raw TX:", rawTxHex)

	// Broadcast
	client, err := rpcclient.New(&rpcclient.ConnConfig{
		Host:         os.Getenv("RPC_HOST"),
		User:         os.Getenv("RPC_USER"),
		Pass:         os.Getenv("RPC_PASS"),
		HTTPPostMode: true,
		DisableTLS:   true,
	}, nil)
	if err != nil {
		log.Fatalf("RPC connection error: %v", err)
	}
	txid, err := client.SendRawTransaction(tx, false)
	if err != nil {
		log.Fatalf("Broadcast failed: %v", err)
	}
	fmt.Println("Refund TXID:", txid.String())
}

func hexDecode(s string) []byte {
	b, _ := hex.DecodeString(s)
	return b
}
