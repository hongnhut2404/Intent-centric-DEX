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

type FundData struct {
	Address string `json:"address"`
}

type HTLC struct {
	Txid         string  `json:"txid,omitempty"`
	Vout         uint32  `json:"vout,omitempty"`
	Amount       float64 `json:"amount,omitempty"`
	RedeemScript string  `json:"redeemScript,omitempty"`
}

type State struct {
	Alice *KeyInfo `json:"alice"`
	Bob   *KeyInfo `json:"bob"`
	HTLC  *HTLC    `json:"htlc,omitempty"`
}

func SaveState(stateFile string, state *State) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %v", err)
	}
	if err := os.WriteFile(stateFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %v", stateFile, err)
	}
	return nil
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

	// Save to fund.json
	fund := FundData{
		Address: address.EncodeAddress(),
	}
	fundBytes, err := json.MarshalIndent(fund, "", "  ")
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal fund.json: %v", err)
	}
	err = os.WriteFile("data/fund.json", fundBytes, 0644)
	if err != nil {
		return "", "", fmt.Errorf("failed to write fund.json: %v", err)
	}
	fmt.Println("Saved fund.json with P2SH address")

	// Save redeemScript to state.json as well
	if state.HTLC == nil {
		state.HTLC = &HTLC{}
	}
	state.HTLC.RedeemScript = redeemScriptHex

	// Save state.json with helper
	if err := SaveState(stateFile, &state); err != nil {
		return "", "", fmt.Errorf("failed to save state: %v", err)
	}

	return redeemScriptHex, address.EncodeAddress(), nil
}
