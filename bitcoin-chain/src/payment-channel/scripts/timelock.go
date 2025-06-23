package scripts

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
)

func GenerateHTLCScript(stateFile string, hashlock string, timelock int64) (string, string, error) {
	// Load keys
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return "", "", fmt.Errorf("failed to read state file: %v", err)
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return "", "", fmt.Errorf("failed to parse state file: %v", err)
	}
	if state.Alice == nil || state.Bob == nil {
		return "", "", fmt.Errorf("missing keys for alice or bob")
	}

	alicePubKey, err := hex.DecodeString(state.Alice.PubKey)
	if err != nil {
		return "", "", fmt.Errorf("invalid Alice pubkey: %v", err)
	}
	bobPubKey, err := hex.DecodeString(state.Bob.PubKey)
	if err != nil {
		return "", "", fmt.Errorf("invalid Bob pubkey: %v", err)
	}
	hashlockBytes, err := hex.DecodeString(hashlock)
	if err != nil || len(hashlockBytes) != 32 {
		return "", "", fmt.Errorf("invalid hashlock: must be 32-byte hex string")
	}

	builder := txscript.NewScriptBuilder()

	builder.AddOp(txscript.OP_IF)
	builder.AddData(alicePubKey)
	builder.AddOp(txscript.OP_CHECKSIGVERIFY)
	builder.AddOp(txscript.OP_SHA256)
	builder.AddData(hashlockBytes)
	builder.AddOp(txscript.OP_EQUALVERIFY)

	builder.AddOp(txscript.OP_ELSE)
	builder.AddInt64(timelock)
	builder.AddOp(txscript.OP_CHECKLOCKTIMEVERIFY)
	builder.AddOp(txscript.OP_DROP)
	builder.AddData(bobPubKey)
	builder.AddOp(txscript.OP_CHECKSIG)
	builder.AddOp(txscript.OP_ENDIF)

	script, err := builder.Script()
	if err != nil {
		return "", "", fmt.Errorf("failed to build script: %v", err)
	}

	scriptHex := hex.EncodeToString(script)

	address, err := btcutil.NewAddressScriptHash(script, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate P2SH address: %v", err)
	}

	fmt.Println("HTLC Script:", scriptHex)
	fmt.Println("P2SH Address:", address.EncodeAddress())

	return scriptHex, address.EncodeAddress(), nil
}
