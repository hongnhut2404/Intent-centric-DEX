package keys

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

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

	// Generate private key
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		panic(err)
	}
	pubKey := privKey.PubKey()

	// Generate address for regtest
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

	// Load existing state.json if it exists
	var state State
	if _, err := os.Stat(stateFile); err == nil {
		data, err := os.ReadFile(stateFile)
		if err == nil {
			json.Unmarshal(data, &state)
		}
	}

	// Update state with new key
	if role == "alice" {
		state.Alice = keyInfo
	} else {
		state.Bob = keyInfo
	}

	// Save back to state file
	newData, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		panic(err)
	}

	// Ensure directory exists
	if err := os.MkdirAll("data", 0755); err != nil {
		panic(fmt.Errorf("failed to create data directory: %v", err))
	}

	// then save
	if err := os.WriteFile(stateFile, newData, 0644); err != nil {
		panic(err)
	}
}
