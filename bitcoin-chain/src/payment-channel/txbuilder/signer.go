package txbuilder

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type SignState struct {
	Alice struct {
		PrivKey string `json:"privkey"`
		PubKey  string `json:"pubkey"`
		Address string `json:"address"`
	} `json:"alice"`

	HTLC struct {
		Txid         string  `json:"txid"`
		Vout         uint32  `json:"vout"`
		Amount       float64 `json:"amount"`
		RedeemScript string  `json:"redeemScript"`
	} `json:"htlc"`
}

func SignCommitmentTx(statePath string, preimage string) error {
	// Load state
	raw, err := os.ReadFile(statePath)
	if err != nil {
		return fmt.Errorf("failed to read state file: %v", err)
	}

	var state SignState
	if err := json.Unmarshal(raw, &state); err != nil {
		return fmt.Errorf("invalid state file: %v", err)
	}

	// Load unsigned tx from file
	txHex, err := os.ReadFile("data/commit-unsigned.txt")
	if err != nil {
		return fmt.Errorf("failed to read raw commitment tx: %v", err)
	}

	rawTxBytes, err := hex.DecodeString(string(txHex))
	if err != nil {
		return fmt.Errorf("invalid raw tx hex: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	if err := tx.Deserialize(bytes.NewReader(rawTxBytes)); err != nil {
		return fmt.Errorf("failed to parse tx: %v", err)
	}

	// Prepare signing
	redeemScript, err := hex.DecodeString(state.HTLC.RedeemScript)
	if err != nil {
		return fmt.Errorf("invalid redeem script: %v", err)
	}

	privKeyBytes, _ := hex.DecodeString(state.Alice.PrivKey)
	privKey, pubKey := btcec.PrivKeyFromBytes(privKeyBytes)

	sig, err := txscript.RawTxInSignature(tx, 0, redeemScript, txscript.SigHashAll, privKey)
	if err != nil {
		return fmt.Errorf("failed to sign input: %v", err)
	}

	// Create final scriptSig: <sig> <pubkey> <preimage> 1 <redeemScript>
	builder := txscript.NewScriptBuilder()
	builder.AddData(sig)
	builder.AddData(pubKey.SerializeCompressed())
	builder.AddData([]byte(preimage))
	builder.AddInt64(1) // Select OP_IF branch (Alice)
	builder.AddData(redeemScript)

	scriptSig, err := builder.Script()
	if err != nil {
		return fmt.Errorf("failed to build scriptSig: %v", err)
	}
	tx.TxIn[0].SignatureScript = scriptSig

	// Serialize signed tx
	var buf bytes.Buffer
	tx.Serialize(&buf)
	finalHex := hex.EncodeToString(buf.Bytes())

	fmt.Println("Signed Commitment Tx:", finalHex)
	return os.WriteFile("data/commit-signed.txt", []byte(finalHex), 0644)
}
