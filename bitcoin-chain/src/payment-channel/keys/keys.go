package keys

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
)

type KeyInfo struct {
	PrivKey string `json:"privkey"`
	PubKey  string `json:"pubkey"`
	Address string `json:"address"`
}

type State struct {
	Alice *KeyInfo `json:"alice,omitempty"`
	Bob   *KeyInfo `json:"bob,omitempty"`
}

func GenerateAndStoreKeys(stateFile string, role string) {
	if role != "alice" && role != "bob" {
		fmt.Println("Invalid role. Must be 'alice' or 'bob'")
		return
	}

	// Generate key pair
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		panic(err)
	}
	pubKey := privKey.PubKey()

	// Generate regtest address
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &chaincfg.RegressionNetParams)
	if err != nil {
		panic(err)
	}

	keyInfo := &KeyInfo{
		PrivKey: hex.EncodeToString(privKey.Serialize()),
		PubKey:  hex.EncodeToString(pubKey.SerializeCompressed()),
		Address: address.EncodeAddress(),
	}

	fmt.Printf("Generated %s key:\n", role)
	fmt.Println("Private Key:", keyInfo.PrivKey)
	fmt.Println("Public Key :", keyInfo.PubKey)
	fmt.Println("Address    :", keyInfo.Address)

	// Load existing state if available
	var state State
	if _, err := os.Stat(stateFile); err == nil {
		data, err := os.ReadFile(stateFile)
		if err == nil {
			json.Unmarshal(data, &state)
		}
	}

	// Update key based on role
	if role == "alice" {
		state.Alice = keyInfo
	} else {
		state.Bob = keyInfo
	}

	// Ensure directory exists
	dir := filepath.Dir(stateFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		panic(fmt.Errorf("failed to create directory: %v", err))
	}

	// Save updated state
	newData, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		panic(err)
	}

	if err := os.WriteFile(stateFile, newData, 0644); err != nil {
		panic(err)
	}
}
