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

type KeyInfo struct {
	PrivKey string `json:"privkey"`
	PubKey  string `json:"pubkey"`
	Address string `json:"address"`
}

type State struct {
	Alice *KeyInfo `json:"alice"`
	Bob   *KeyInfo `json:"bob"`
}

func GenerateMultisig(stateFile string) (string, string, error) {
	// Load state.json
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

	// Decode pubkeys
	alicePubKeyBytes, err := hex.DecodeString(state.Alice.PubKey)
	if err != nil {
		return "", "", fmt.Errorf("invalid alice pubkey: %v", err)
	}
	bobPubKeyBytes, err := hex.DecodeString(state.Bob.PubKey)
	if err != nil {
		return "", "", fmt.Errorf("invalid bob pubkey: %v", err)
	}

	// Convert to AddressPubKey
	aliceAddrPubKey, err := btcutil.NewAddressPubKey(alicePubKeyBytes, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to create AddressPubKey for Alice: %v", err)
	}
	bobAddrPubKey, err := btcutil.NewAddressPubKey(bobPubKeyBytes, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to create AddressPubKey for Bob: %v", err)
	}

	// Build multisig redeem script (2-of-2)
	redeemScript, err := txscript.MultiSigScript(
		[]*btcutil.AddressPubKey{aliceAddrPubKey, bobAddrPubKey},
		2)
	if err != nil {
		return "", "", fmt.Errorf("failed to build multisig script: %v", err)
	}

	// Generate P2SH address
	address, err := btcutil.NewAddressScriptHash(redeemScript, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to create p2sh address: %v", err)
	}

	redeemScriptHex := hex.EncodeToString(redeemScript)
	fmt.Println("Redeem Script:", redeemScriptHex)
	fmt.Println("P2SH Address :", address.EncodeAddress())

	return redeemScriptHex, address.EncodeAddress(), nil
}
