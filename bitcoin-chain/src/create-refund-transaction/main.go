package main

import (
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
)

// CreateRefundHTLCContract creates a P2SH address with a timelocked refund-only HTLC
func CreateRefundHTLCContract(senderPubKeyHex string, locktime int64) (string, string, error) {
	// Decode and validate sender public key
	senderPubKeyBytes, err := hex.DecodeString(senderPubKeyHex)
	if err != nil {
		return "", "", fmt.Errorf("invalid sender pubkey hex: %w", err)
	}
	if len(senderPubKeyBytes) != 33 || (senderPubKeyBytes[0] != 0x02 && senderPubKeyBytes[0] != 0x03) {
		return "", "", fmt.Errorf("senderPubKeyHex must be a 33-byte compressed public key")
	}

	// Validate locktime
	if locktime < 0 || locktime > 0xFFFFFFFF {
		return "", "", fmt.Errorf("locktime must be between 0 and 4294967295")
	}

	// Parse public key
	senderPubKey, err := btcec.ParsePubKey(senderPubKeyBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse sender pubkey: %w", err)
	}

	// Build redeem script
	builder := txscript.NewScriptBuilder().
		AddInt64(locktime).                          // <locktime>
		AddOp(txscript.OP_CHECKLOCKTIMEVERIFY).      // OP_CHECKLOCKTIMEVERIFY
		AddOp(txscript.OP_DROP).                     // OP_DROP
		AddData(senderPubKey.SerializeCompressed()). // <senderPubKey>
		AddOp(txscript.OP_CHECKSIG)                  // OP_CHECKSIG

	redeemScript, err := builder.Script()
	if err != nil {
		return "", "", fmt.Errorf("failed to build redeem script: %w", err)
	}

	// Hash to get P2SH address
	scriptHash := btcutil.Hash160(redeemScript)
	address, err := btcutil.NewAddressScriptHashFromHash(scriptHash, &chaincfg.RegressionNetParams)
	if err != nil {
		return "", "", fmt.Errorf("failed to create P2SH address: %w", err)
	}

	// Return P2SH address and redeem script in hex
	return address.EncodeAddress(), hex.EncodeToString(redeemScript), nil
}

func main() {
	// Example input
	senderPubKeyHex := "0203a1b2c3d4e5f67890aabbccddeeff00112233445566778899aabbccddeeff00" // Replace with actual pubkey
	locktime := int64(1700000)                                                              // Example locktime: block height or UNIX timestamp

	address, redeemScriptHex, err := CreateRefundHTLCContract(senderPubKeyHex, locktime)
	if err != nil {
		fmt.Printf("Error creating refund HTLC: %v\n", err)
		return
	}

	fmt.Println("Refund HTLC P2SH Address:", address)
	fmt.Println("Redeem Script (hex):", redeemScriptHex)
}
