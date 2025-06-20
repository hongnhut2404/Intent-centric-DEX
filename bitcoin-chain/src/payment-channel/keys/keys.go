// === keys/keys.go ===
package keys

import (
	"encoding/hex"
	"fmt"
	"os"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
)

func GenerateAndStoreKeys(stateFile string) {
	privKey, err := btcec.NewPrivateKey()
	if err != nil {
		panic(err)
	}
	pubKey := privKey.PubKey()

	addr, _ := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &chaincfg.RegressionNetParams)
	fmt.Println("Generated Key:")
	fmt.Println("Private:", hex.EncodeToString(privKey.Serialize()))
	fmt.Println("Address:", addr.EncodeAddress())
	// Store keys in JSON (skipped here for brevity)
	_ = os.WriteFile(stateFile, []byte("{\"privkey\":\""+hex.EncodeToString(privKey.Serialize())+"\"}"), 0644)
}
