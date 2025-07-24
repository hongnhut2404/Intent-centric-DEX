package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os/exec"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

type InputSignRedeemTransaction struct {
	tx                 *wire.MsgTx
	redeemScript       string
	mySecret           string
	receiverPrivKeyWif string
	receiverPubKey     string
}

func decodeTx(txHex string) (*wire.MsgTx, error) {
	rawTx, err := hex.DecodeString(txHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	err = tx.Deserialize(bytes.NewReader(rawTx))
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize tx: %v", err)
	}
	return tx, nil
}

// extractPreimageHash extracts the 32-byte preimage hash from an HTLC redeem script
func extractPreimageHash(redeemScriptBytes []byte) ([]byte, error) {
	// Ensure script is long enough for OP_HASH256 + push opcode + 32-byte hash
	if len(redeemScriptBytes) < 34 {
		return nil, fmt.Errorf("redeem script too short to contain preimage hash (%d bytes)", len(redeemScriptBytes))
	}

	// Look for OP_HASH256 (0xa8) followed by 0x20 (push 32 bytes)
	for i := 0; i < len(redeemScriptBytes)-33; i++ {
		if redeemScriptBytes[i] == txscript.OP_SHA256 { // Use 0xa8 directly due to OP_HASH256 mismatch
			if redeemScriptBytes[i+1] == 0x20 {
				hash := redeemScriptBytes[i+2 : i+34]
				return hash, nil
			}
		}
	}
	return nil, fmt.Errorf("preimage hash not found in redeem script")
}

// signTransaction signs the transaction with the private key, secret, and redeem script
func signTransaction(input InputSignRedeemTransaction, netParams *chaincfg.Params) (string, error) {
	// Decode redeem script
	redeemScriptBytes, err := hex.DecodeString(input.redeemScript)
	if err != nil {
		return "", fmt.Errorf("error decoding redeem script: %v", err)
	}

	// Decode private key from hex (not WIF)
	privKeyBytes, err := hex.DecodeString(input.receiverPrivKeyWif)
	if err != nil {
		return "", fmt.Errorf("error decoding hex private key: %v", err)
	}
	privKey, _ := btcec.PrivKeyFromBytes(privKeyBytes)
	pubKey := privKey.PubKey()

	// Verify public key
	expectedPubKey, err := hex.DecodeString(input.receiverPubKey)
	if err != nil {
		return "", fmt.Errorf("error decoding expected public key: %v", err)
	}
	if !bytes.Equal(pubKey.SerializeCompressed(), expectedPubKey) {
		return "", fmt.Errorf("private key does not match public key in redeem script")
	}

	// Extract preimage hash from redeem script
	expectedHashBytes, err := extractPreimageHash(redeemScriptBytes)
	if err != nil {
		return "", fmt.Errorf("error extracting preimage hash: %v", err)
	}

	// Verify preimage hash
	hash := sha256.Sum256([]byte(input.mySecret))
	if !bytes.Equal(hash[:], expectedHashBytes) {
		hashHex := hex.EncodeToString(hash[:])
		expectedHashHex := hex.EncodeToString(expectedHashBytes)
		return "", fmt.Errorf("preimage hash %s does not match expected hash %s", hashHex, expectedHashHex)
	}

	// Compute sighash for P2SH
	sighash, err := txscript.CalcSignatureHash(redeemScriptBytes, txscript.SigHashAll, input.tx, 0)
	if err != nil {
		return "", fmt.Errorf("error calculating sighash: %v", err)
	}

	// Sign the sighash
	signature := ecdsa.Sign(privKey, sighash)
	sigWithHashType := append(signature.Serialize(), byte(txscript.SigHashAll))

	// Construct scriptSig for P2SH (HTLC success path: signature, preimage, OP_TRUE, redeemScript)
	scriptSig, err := txscript.NewScriptBuilder().
		AddData(sigWithHashType).
		AddData([]byte(input.mySecret)).
		AddData([]byte{1}). // OP_TRUE for HTLC success path
		AddData(redeemScriptBytes).
		Script()
	if err != nil {
		return "", fmt.Errorf("error creating scriptSig: %v", err)
	}

	// Set scriptSig
	input.tx.TxIn[0].SignatureScript = scriptSig

	// Serialize the transaction
	var signedTx bytes.Buffer
	err = input.tx.Serialize(&signedTx)
	if err != nil {
		return "", fmt.Errorf("error serializing transaction: %v", err)
	}

	// Broadcast using bitcoin-cli sendrawtransaction
	cmd := exec.Command("bitcoin-cli", "sendrawtransaction", hex.EncodeToString(signedTx.Bytes()))
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to broadcast transaction: %v\n%s", err, output)
	}
	fmt.Printf("Transaction broadcasted successfully. TXID: %s\n", output)

	return hex.EncodeToString(signedTx.Bytes()), nil
}
