package main

import (
	"fmt"
	"log"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
)

func main() {
	// Generate a new private key
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		log.Fatalf("failed to generate private key: %v", err)
	}

	// Get the associated public key
	pubKey := privKey.PubKey()

	// Use regtest network params
	netParams := &chaincfg.RegressionNetParams

	// Create a regtest P2WPKH address (bech32) from the public key
	pubKeyHash := btcutil.Hash160(pubKey.SerializeCompressed())
	address, err := btcutil.NewAddressWitnessPubKeyHash(pubKeyHash, netParams)
	if err != nil {
		log.Fatalf("failed to create address: %v", err)
	}

	fmt.Printf("Private Key (WIF): %s\n", mustWIF(privKey, netParams))
	fmt.Printf("Public Key: %x\n", pubKey.SerializeCompressed())
	fmt.Printf("Address (regtest bech32): %s\n", address.EncodeAddress())
}

func mustWIF(priv *btcec.PrivateKey, net *chaincfg.Params) string {
	wif, err := btcutil.NewWIF(priv, net, true)
	if err != nil {
		log.Fatalf("failed to encode WIF: %v", err)
	}
	return wif.String()
}
