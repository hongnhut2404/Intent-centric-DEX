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
	paths := []string{"../../.env", "../.env", "./.env"}
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			return
		}
	}
	log.Fatal("Error loading .env from any known location")
}

func ReadInput(filePath string) (map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("unable to open file: %w", err)
	}
	defer file.Close()

	bytes, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("unable to read file: %w", err)
	}

	var data map[string]interface{}
	err = json.Unmarshal(bytes, &data)
	if err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}

	return data, nil
}

func FundHTLC() error {
	// Load HTLC P2SH address
	htlcFile := "../../data-script/address-test.json"
	htlcRaw, err := ioutil.ReadFile(htlcFile)
	if err != nil {
		return fmt.Errorf("failed to read address-test.json: %v", err)
	}
	var htlcData map[string]interface{}
	if err := json.Unmarshal(htlcRaw, &htlcData); err != nil {
		return fmt.Errorf("invalid JSON in address-test.json: %v", err)
	}
	htlc := htlcData["HTLC"].([]interface{})[0].(map[string]interface{})
	htlcAddr := htlc["address"].(string)

	// Load UTXO data (from scanned output)
	utxoRaw, err := ioutil.ReadFile("../../data-script/utxo.json")
	if err != nil {
		return fmt.Errorf("failed to read utxo.json: %v", err)
	}
	var utxo map[string]interface{}
	if err := json.Unmarshal(utxoRaw, &utxo); err != nil {
		return fmt.Errorf("invalid JSON in utxo.json: %v", err)
	}
	unspents := utxo["unspents"].([]interface{})
	first := unspents[0].(map[string]interface{})

	txidStr := first["txid"].(string)
	vout := int(first["vout"].(float64))
	utxoAmount := btcutil.Amount(first["amount"].(float64) * 1e8)
	scriptPubKeyHex := first["scriptPubKey"].(string)

	// Load BTC amount from payment message
	msg, err := ReadInput("../payment-channel/data/payment_message.json")
	if err != nil {
		return fmt.Errorf("failed to read payment_message.json: %v", err)
	}
	btcAmount := btcutil.Amount(msg["btc_amount"].(float64) * 1e8)
	fee := btcutil.Amount(500)

	if utxoAmount < btcAmount+fee {
		return fmt.Errorf("UTXO amount (%d) < required (btc: %d + fee: %d)", utxoAmount, btcAmount, fee)
	}

	// Load Bob's private key
	state, err := ReadInput("../payment-channel/data/state.json")
	if err != nil {
		return fmt.Errorf("failed to read state.json: %v", err)
	}
	bob := state["bob"].(map[string]interface{})
	privHex := bob["privkey"].(string)
	privBytes, _ := hex.DecodeString(privHex)
	privKey, _ := btcec.PrivKeyFromBytes(privBytes)
	bobAddr, _ := btcutil.DecodeAddress(bob["address"].(string), &chaincfg.RegressionNetParams)
	bobScript, _ := txscript.PayToAddrScript(bobAddr)

	// Construct raw tx
	tx := wire.NewMsgTx(wire.TxVersion)
	txHash, _ := chainhash.NewHashFromStr(txidStr)
	tx.AddTxIn(wire.NewTxIn(wire.NewOutPoint(txHash, uint32(vout)), nil, nil))

	// Output 1: HTLC
	htlcObj, _ := btcutil.DecodeAddress(htlcAddr, &chaincfg.RegressionNetParams)
	htlcScript, _ := txscript.PayToAddrScript(htlcObj)
	tx.AddTxOut(wire.NewTxOut(int64(btcAmount), htlcScript))

	// Output 2: Change (optional)
	change := utxoAmount - btcAmount - fee
	if change > 0 {
		tx.AddTxOut(wire.NewTxOut(int64(change), bobScript))
	}

	// Sign
	scriptPubKey, _ := hex.DecodeString(scriptPubKeyHex)
	sigScript, err := txscript.SignatureScript(tx, 0, scriptPubKey, txscript.SigHashAll, privKey, true)
	if err != nil {
		return fmt.Errorf("failed to sign tx: %v", err)
	}
	tx.TxIn[0].SignatureScript = sigScript

	// Print tx hex
	var buf bytes.Buffer
	tx.Serialize(&buf)
	fmt.Println("Raw Signed Transaction:")
	fmt.Println(hex.EncodeToString(buf.Bytes()))

	// Optionally broadcast via RPC
	loadEnv()
	client, err := rpcclient.New(&rpcclient.ConnConfig{
		Host:         os.Getenv("RPC_HOST"),
		User:         os.Getenv("RPC_USER"),
		Pass:         os.Getenv("RPC_PASS"),
		HTTPPostMode: true,
		DisableTLS:   true,
	}, nil)
	if err != nil {
		return fmt.Errorf("failed to connect RPC: %v", err)
	}
	txID, err := client.SendRawTransaction(tx, false)
	if err != nil {
		return fmt.Errorf("broadcast failed: %v", err)
	}
	fmt.Println("Broadcasted HTLC funding TXID:", txID.String())

	return nil
}

func main() {
	if err := FundHTLC(); err != nil {
		log.Fatalf("Error: %v", err)
	}
}
