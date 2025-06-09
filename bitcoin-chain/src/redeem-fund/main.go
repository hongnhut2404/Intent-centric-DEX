package main

import (
	"encoding/hex"
	"fmt"
)

func main() {
	preimage := "mysecret"
	preimageHex := hex.EncodeToString([]byte(preimage))
	redeemScript := "63a820652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0882102578db1df79bb2068c4fc808ec9da1a8c3cb35d654b1599c9c7ea8f3dcb358958ac6702c800b17521030da87c54462810fe8f7453599fe54d025f3aac07937bcebfe4a0e386281f03bbac68"

	inputs := []TxInput{
		{
			TxID:         "0ec0e5db35353113d88624d4db516cdbe189ed8ea2f7dc9be8d5ea3405e1ef25",                                                                                                                                                                   // Replace with your UTXO TXID
			Vout:         0,                                                                                                                                                                                                                                    // Replace with your UTXO Vout
			ScriptPubKey: "a91408e827321d3bb8d3bf74d8c6891910dbaaffc93787",                                                                                                                                                                                     // Replace with your UTXO scriptPubKey (P2SH)
			RedeemScript: "63a820652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0882102578db1df79bb2068c4fc808ec9da1a8c3cb35d654b1599c9c7ea8f3dcb358958ac6702c800b17521030da87c54462810fe8f7453599fe54d025f3aac07937bcebfe4a0e386281f03bbac68", // Replace with your HTLC redeem script in hex
			Amount:       10.0,                                                                                                                                                                                                                                 // Replace with your UTXO amount in BTC
			WitnessData:  []string{"", preimageHex, redeemScript},
		},
	}

	outputs := []TxOutput{
		{
			Address: "bcrt1qk283starw0cqjepyjxkrwgpu8lruxh77rvggx2", // Replace with the recipient address (regtest)
			Amount:  9.99,                                           // Replace with the output amount
		},
	}

	locktime := uint32(0)

	rawTx, err := CreateRawTransaction(inputs, outputs, locktime)
	if err != nil {
		fmt.Println("Error creating raw transaction:", err)
		return
	}
	fmt.Println("Raw Transaction:", rawTx)
}
