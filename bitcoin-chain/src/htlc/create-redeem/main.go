package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
	"github.com/joho/godotenv"
)

/* ======================================
   ENV / CONFIG
   ====================================== */

func loadEnv() {
	paths := []string{"../../../.env", "../../.env", "../.env", "./.env"}
	for _, p := range paths {
		if err := godotenv.Load(p); err == nil {
			return
		}
	}
	// Not fatal if you prefer; but this keeps behavior explicit
	log.Fatal("Error loading .env from known locations")
}

var (
	// bitcoind RPC (regtest)
	rpcURL  = "http://127.0.0.1:8332"
	rpcUser = "admin"
	rpcPass = "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"

	// network
	netParams = &chaincfg.RegressionNetParams
)

/* ======================================
   Types / helpers
   ====================================== */

type rpcReq struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}
type rpcResp struct {
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
	ID     string          `json:"id"`
}
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func callRPC(method string, params []interface{}) (json.RawMessage, error) {
	body, _ := json.Marshal(rpcReq{
		Jsonrpc: "1.0",
		ID:      "create-redeem",
		Method:  method,
		Params:  params,
	})
	req, err := http.NewRequest("POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(rpcUser, rpcPass)
	req.Header.Set("Content-Type", "application/json")

	cli := &http.Client{Timeout: 30 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rr rpcResp
	if err := json.NewDecoder(resp.Body).Decode(&rr); err != nil {
		return nil, err
	}
	if rr.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rr.Error.Code, rr.Error.Message)
	}
	return rr.Result, nil
}

type utxoFile struct {
	Success     bool    `json:"success"`
	TotalAmount float64 `json:"total_amount"`
	Unspents    []struct {
		Txid         string  `json:"txid"`
		Vout         int     `json:"vout"`
		ScriptPubKey string  `json:"scriptPubKey"`
		Amount       float64 `json:"amount"`
		Height       *int64  `json:"height,omitempty"`
	} `json:"unspents"`
}

func readUTXO() (txid string, vout int, amountBTC float64, err error) {
	path := os.Getenv("UTXO_HTLC_JSON")
	if path == "" {
		return "", 0, 0, fmt.Errorf("UTXO_HTLC_JSON not set in .env")
	}
	raw, e := os.ReadFile(path)
	if e != nil {
		return "", 0, 0, fmt.Errorf("read %s: %w", path, e)
	}
	var u utxoFile
	if e := json.Unmarshal(raw, &u); e != nil {
		return "", 0, 0, fmt.Errorf("decode %s: %w", path, e)
	}
	if len(u.Unspents) == 0 {
		return "", 0, 0, fmt.Errorf("no unspents in %s", path)
	}
	return u.Unspents[0].Txid, u.Unspents[0].Vout, u.Unspents[0].Amount, nil
}

func readReceiverAlice() (string, error) {
	path := os.Getenv("STATE_PATH_HTLC")
	if path == "" {
		return "", fmt.Errorf("STATE_PATH_HTLC not set in .env")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	var st map[string]map[string]interface{}
	if err := json.Unmarshal(raw, &st); err != nil {
		return "", fmt.Errorf("decode %s: %w", path, err)
	}
	alice, ok := st["alice"]
	if !ok {
		return "", fmt.Errorf("'alice' missing in %s", path)
	}
	addr, ok := alice["address"].(string)
	if !ok || addr == "" {
		return "", fmt.Errorf("invalid alice.address in %s", path)
	}
	return addr, nil
}

// Optional: if you still want to use the message’s btc_amount
func readBTCAmountFromMessage() (float64, error) {
	path := os.Getenv("PAYMENT_MESSAGE_HTLC")
	if path == "" {
		return 0, fmt.Errorf("PAYMENT_MESSAGE_HTLC not set in .env")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", path, err)
	}
	var m struct {
		BTCAmount float64 `json:"btc_amount"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		return 0, fmt.Errorf("decode %s: %w", path, err)
	}
	if m.BTCAmount <= 0 {
		return 0, fmt.Errorf("btc_amount <= 0 in %s", path)
	}
	return m.BTCAmount, nil
}

// feerate BTC/kvB -> sats/vB  ; fallback 1 sat/vB
func estimateSatPerVByte() (float64, error) {
	res, err := callRPC("estimatesmartfee", []interface{}{2})
	if err != nil {
		return 1.0, nil // OK for regtest
	}
	var o struct {
		Feerate *float64 `json:"feerate"`
	}
	if err := json.Unmarshal(res, &o); err != nil || o.Feerate == nil || *o.Feerate <= 0 {
		return 1.0, nil
	}
	return (*o.Feerate) * 1e8 / 1000.0, nil // BTC/kvB -> sats/vB
}

// crude size estimate for 1-in/1-out P2SH-HTLC legacy spend
func estimateRedeemVSize() int { return 360 }

/* ======================================
   Tx builder
   ====================================== */

type InputRawRedeemTransaction struct {
	prevTxHash      string
	prevOutputIndex uint32
	outputAddr      string
	outputAmount    float64 // in BTC
}

func createRawTransaction(in InputRawRedeemTransaction, params *chaincfg.Params) (*wire.MsgTx, error) {
	tx := wire.NewMsgTx(1)

	// input
	h, err := chainhash.NewHashFromStr(in.prevTxHash)
	if err != nil {
		return nil, fmt.Errorf("bad prev tx hash: %w", err)
	}
	outPoint := wire.NewOutPoint(h, in.prevOutputIndex)
	txIn := wire.NewTxIn(outPoint, nil, nil) // scriptSig will be added at signing time
	txIn.Sequence = 0xffffffff
	tx.AddTxIn(txIn)

	// output
	addr, err := btcutil.DecodeAddress(in.outputAddr, params)
	if err != nil {
		return nil, fmt.Errorf("decode address: %w", err)
	}
	pkScript, err := txscript.PayToAddrScript(addr)
	if err != nil {
		return nil, fmt.Errorf("make p2pkh script: %w", err)
	}
	valueSats := int64(math.Round(in.outputAmount * 1e8))
	if valueSats <= 0 {
		return nil, fmt.Errorf("non-positive output amount (sats): %d", valueSats)
	}
	txOut := wire.NewTxOut(valueSats, pkScript)
	tx.AddTxOut(txOut)

	return tx, nil
}

/* ======================================
   main
   ====================================== */

func main() {
	loadEnv()

	// Allow overriding RPC creds via .env
	if v := os.Getenv("BTC_RPC_URL"); v != "" {
		rpcURL = v
	}
	if v := os.Getenv("BTC_RPC_USER"); v != "" {
		rpcUser = v
	}
	if v := os.Getenv("BTC_RPC_PASS"); v != "" {
		rpcPass = v
	}

	// Read HTLC UTXO (txid, vout, amount)
	txid, vout, utxoAmtBTC, err := readUTXO()
	if err != nil {
		log.Fatalf("Failed to read UTXO: %v", err)
	}

	// Receiver (Alice) address from state.json
	receiverAddr, err := readReceiverAlice()
	if err != nil {
		log.Fatalf("Failed to read receiver: %v", err)
	}

	// Fee
	satPerVB, _ := estimateSatPerVByte()
	if satPerVB <= 0 {
		satPerVB = 1
	}
	feeSats := int64(math.Ceil(float64(estimateRedeemVSize()) * satPerVB))

	// ===== IMPORTANT =====
	// Use the ACTUAL UTXO amount for the redeem output, not the message amount:
	outputAmountBTC := (utxoAmtBTC*1e8 - float64(feeSats)) / 1e8

	// If you insist on using the message’s btc_amount instead, replace the line above with:
	// msgAmt, _ := readBTCAmountFromMessage()
	// outputAmountBTC = (msgAmt*1e8 - float64(feeSats)) / 1e8

	if outputAmountBTC <= 0 {
		log.Fatalf("Fee too large; output <= 0 (utxo=%.8f, fee=%d sats)", utxoAmtBTC, feeSats)
	}

	rawInput := InputRawRedeemTransaction{
		prevTxHash:      txid,
		prevOutputIndex: uint32(vout),
		outputAddr:      receiverAddr,
		outputAmount:    outputAmountBTC,
	}

	tx, err := createRawTransaction(rawInput, netParams)
	if err != nil {
		log.Fatalf("Error creating raw transaction: %v", err)
	}

	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		log.Fatalf("Failed to serialize transaction: %v", err)
	}
	rawTxHex := hex.EncodeToString(buf.Bytes())
	fmt.Println("Raw redeem transaction (hex):", rawTxHex)

	// Output JSON
	outputPath := os.Getenv("REDEEM_TX_OUTPUT")
	if outputPath == "" {
		outputPath = "../../../data-script/redeem_tx.json"
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		log.Fatalf("mkdir %s: %v", filepath.Dir(outputPath), err)
	}
	out := map[string]interface{}{
		"raw_redeem_transaction": rawTxHex,
	}
	if err := ioutil.WriteFile(outputPath, mustJSON(out), 0o644); err != nil {
		log.Fatalf("Failed to write %s: %v", outputPath, err)
	}
	fmt.Println("Transaction saved to", outputPath)
}

func mustJSON(v interface{}) []byte {
	b, _ := json.MarshalIndent(v, "", "  ")
	return b
}
