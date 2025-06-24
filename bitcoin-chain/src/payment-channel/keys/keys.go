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
	PrivKey string `json:"privkey"` // hex encoded
	PubKey  string `json:"pubkey"`  // hex encoded (compressed)
	Address string `json:"address"` // Bech32 P2WPKH regtest
}

type State struct {
	Alice *KeyInfo `json:"alice,omitempty"`
	Bob   *KeyInfo `json:"bob,omitempty"`
}

// GenerateAndStoreKeys generates a keypair for Alice or Bob and stores it in the state file
func GenerateAndStoreKeys(stateFile string, role string) {
	if role != "alice" && role != "bob" {
		fmt.Println("Invalid role. Must be 'alice' or 'bob'")
		return
	}

	// Generate a new private key
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		panic(fmt.Errorf("failed to generate private key: %v", err))
	}
	pubKey := privKey.PubKey()

	// Create P2WPKH Bech32 address (regtest)
	pubKeyHash := btcutil.Hash160(pubKey.SerializeCompressed())
	address, err := btcutil.NewAddressWitnessPubKeyHash(pubKeyHash, &chaincfg.RegressionNetParams)
	if err != nil {
		panic(fmt.Errorf("failed to generate address: %v", err))
	}

	keyInfo := &KeyInfo{
		PrivKey: hex.EncodeToString(privKey.Serialize()),          // hex-encoded private key
		PubKey:  hex.EncodeToString(pubKey.SerializeCompressed()), // compressed pubkey
		Address: address.EncodeAddress(),                          // bech32 address
	}

	fmt.Printf("Generated %s key:\n", role)
	fmt.Println("Private Key:", keyInfo.PrivKey)
	fmt.Println("Public Key :", keyInfo.PubKey)
	fmt.Println("Address    :", keyInfo.Address)

	// Load existing state file if present
	var state State
	if _, err := os.Stat(stateFile); err == nil {
		data, err := os.ReadFile(stateFile)
		if err == nil {
			json.Unmarshal(data, &state)
		}
	}

	// Update state
	if role == "alice" {
		state.Alice = keyInfo
	} else {
		state.Bob = keyInfo
	}

	// Save to file
	newData, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		panic(fmt.Errorf("failed to marshal state: %v", err))
	}

	if err := os.WriteFile(stateFile, newData, 0644); err != nil {
		panic(fmt.Errorf("failed to write state file: %v", err))
	}
}
