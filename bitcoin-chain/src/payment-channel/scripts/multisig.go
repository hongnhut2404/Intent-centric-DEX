package scripts

import (
	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/txscript"
)

func CreateMultisig(pub1, pub2 *btcec.PublicKey) ([]byte, error) {
	params := &chaincfg.RegressionNetParams

	addr1, err := btcutil.NewAddressPubKey(pub1.SerializeCompressed(), params)
	if err != nil {
		return nil, err
	}
	addr2, err := btcutil.NewAddressPubKey(pub2.SerializeCompressed(), params)
	if err != nil {
		return nil, err
	}

	redeemScript, err := txscript.MultiSigScript([]*btcutil.AddressPubKey{addr1, addr2}, 2)
	if err != nil {
		return nil, err
	}

	return redeemScript, nil
}
