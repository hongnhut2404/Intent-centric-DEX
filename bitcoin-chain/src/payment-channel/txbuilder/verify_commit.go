package txbuilder

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

func VerifyCommitmentProposal(txHex string) error {
	rawTxBytes, err := hex.DecodeString(txHex)
	if err != nil {
		return fmt.Errorf("invalid hex: %v", err)
	}

	tx := wire.NewMsgTx(wire.TxVersion)
	if err := tx.Deserialize(bytes.NewReader(rawTxBytes)); err != nil {
		return fmt.Errorf("failed to parse transaction: %v", err)
	}

	foundOpReturn := false

	for i, out := range tx.TxOut {
		scriptClass, addresses, _, err := txscript.ExtractPkScriptAddrs(
			out.PkScript, &chaincfg.RegressionNetParams,
		)
		if err != nil {
			return fmt.Errorf("script classification failed for output %d: %v", i, err)
		}

		if scriptClass == txscript.NullDataTy {
			// OP_RETURN script, raw data is the push after OP_RETURN
			if len(out.PkScript) > 2 && out.PkScript[0] == txscript.OP_RETURN {
				pushedData := out.PkScript[2:] // skip OP_RETURN + push opcode
				fmt.Printf("Proposed OP_RETURN data: %s\n", string(pushedData))
				foundOpReturn = true
			}
		} else {
			if len(addresses) > 0 {
				fmt.Printf("Output %d sends to address: %s, amount: %.8f BTC\n",
					i, addresses[0].EncodeAddress(), btcutil.Amount(out.Value).ToBTC())
			}
		}
	}

	if !foundOpReturn {
		fmt.Println("No OP_RETURN proposal found in this transaction.")
	}

	return nil
}
