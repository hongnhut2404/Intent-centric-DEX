package main

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

func main() {
	// Raw transaction hex
	rawTxHex := "0200000001cb76728750a45f7715fe0208868b52ee87968e9a55744b5621cb915a9ffca03c0000000000fdffffff01f0a29a3b00000000160014bc4248d12aab52833c9ae745349b5a65f673cee5c8000000"

	// Redeem script
	redeemScriptHex := "63a820652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0882102578db1df79bb2068c4fc808ec9da1a8c3cb35d654b1599c9c7ea8f3dcb358958ac6702c800b17521030da87c54462810fe8f7453599fe54d025f3aac07937bcebfe4a0e386281f03bbac68"
	redeemScript, err := hex.DecodeString(redeemScriptHex)
	if err != nil {
		fmt.Printf("Error decoding redeem script: %v\n", err)
		return
	}

	// Private key (WIF)
	wifStr := "cRj15hByF1jXRYYtSe33vNMQEZuVzV43D9FknCdzxu47uFQYVCLm"
	wif, err := btcutil.DecodeWIF(wifStr)
	if err != nil {
		fmt.Printf("Error decoding WIF: %v\n", err)
		return
	}
	privKey := wif.PrivKey

	// Deserialize transaction
	tx := wire.NewMsgTx(wire.TxVersion)
	txBytes, err := hex.DecodeString(rawTxHex)
	if err != nil {
		fmt.Printf("Error decoding raw tx: %v\n", err)
		return
	}
	if err := tx.Deserialize(bytes.NewReader(txBytes)); err != nil {
		fmt.Printf("Error deserializing tx: %v\n", err)
		return
	}

	// Generate signature
	sig, err := txscript.RawTxInSignature(
		tx, 0, redeemScript, txscript.SigHashAll, privKey,
	)
	if err != nil {
		fmt.Printf("Error signing: %v\n", err)
		return
	}

	// Construct scriptSig: [signature] 0 [redeemScript]
	builder := txscript.NewScriptBuilder()
	builder.AddData(sig) // Signature
	builder.AddInt64(0)  // 0 for ELSE branch
	builder.AddData(redeemScript)
	scriptSig, err := builder.Script()
	if err != nil {
		fmt.Printf("Error building scriptSig: %v\n", err)
		return
	}

	// Set scriptSig
	tx.TxIn[0].SignatureScript = scriptSig

	// Serialize signed transaction
	var signedTxBuf bytes.Buffer
	if err := tx.Serialize(&signedTxBuf); err != nil {
		fmt.Printf("Error serializing signed tx: %v\n", err)
		return
	}
	signedTxHex := hex.EncodeToString(signedTxBuf.Bytes())

	fmt.Println("Signed transaction hex:", signedTxHex)
}
