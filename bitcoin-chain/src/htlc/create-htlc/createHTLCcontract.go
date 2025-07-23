package main

import (
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
)

// CreateHTLCContract creates a P2SH address with a Hash TimeLock Contract
func CreateHTLCContract(senderPubKeyHex, receiverPubKeyHex, hashSecretHex string, locktime int64) (string, string, error) {
	// Decode hex public keys
	senderPubKeyBytes, err := hex.DecodeString(senderPubKeyHex)
	if err != nil {
		return "", "", fmt.Errorf("invalid sender pubkey hex: %w", err)
	}
	receiverPubKeyBytes, err := hex.DecodeString(receiverPubKeyHex)
	if err != nil {
		return "", "", fmt.Errorf("invalid receiver pubkey hex: %w", err)
	}
	hashSecretBytes, err := hex.DecodeString(hashSecretHex)
	if err != nil {
		return "", "", fmt.Errorf("invalid hash secret hex: %w", err)
	}

	// Validate inputs
	if len(hashSecretBytes) != 32 {
		return "", "", fmt.Errorf("hashSecretHex must be a 32-byte SHA256 hash")
	}
	if len(senderPubKeyBytes) != 33 || (senderPubKeyBytes[0] != 0x02 && senderPubKeyBytes[0] != 0x03) {
		return "", "", fmt.Errorf("senderPubKeyHex must be a 33-byte compressed public key")
	}
	if len(receiverPubKeyBytes) != 33 || (receiverPubKeyBytes[0] != 0x02 && receiverPubKeyBytes[0] != 0x03) {
		return "", "", fmt.Errorf("receiverPubKeyHex must be a 33-byte compressed public key")
	}
	if locktime < 0 || locktime > 0xFFFFFFFF {
		return "", "", fmt.Errorf("locktime must be between 0 and 4294967295")
	}

	// Parse public keys
	senderPubKey, err := btcec.ParsePubKey(senderPubKeyBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse sender pubkey: %w", err)
	}
	receiverPubKey, err := btcec.ParsePubKey(receiverPubKeyBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse receiver pubkey: %w", err)
	}

	// Build redeem script (HTLC)
	builder := txscript.NewScriptBuilder()

	// IF receiver can redeem with preimage
	builder.AddOp(txscript.OP_IF).
		AddOp(txscript.OP_SHA256).
		AddData(hashSecretBytes).
		AddOp(txscript.OP_EQUALVERIFY).
		AddData(receiverPubKey.SerializeCompressed()).
		AddOp(txscript.OP_CHECKSIG)

	// ELSE sender can refund after locktime
	builder.AddOp(txscript.OP_ELSE).
		AddInt64(locktime).
		AddOp(txscript.OP_CHECKLOCKTIMEVERIFY).
		AddOp(txscript.OP_DROP).
		AddData(senderPubKey.SerializeCompressed()).
		AddOp(txscript.OP_CHECKSIG)

	// ENDIF
	builder.AddOp(txscript.OP_ENDIF)

	// Get the redeem script
	redeemScript, err := builder.Script()
	if err != nil {
		return "", "", fmt.Errorf("failed to build redeem script: %w", err)
	}

	// Hash the redeem script to get the P2SH address
	scriptHash := btcutil.Hash160(redeemScript)
	address, err := btcutil.NewAddressScriptHashFromHash(scriptHash, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to create P2SH address: %w", err)
	}

	// Return the P2SH address and the redeem script (hex encoded)
	return address.EncodeAddress(), hex.EncodeToString(redeemScript), nil
}
