package main

import (
	"fmt"
	"log"
)

func main() {
	signedHex := "02000000000101914bfcd9644e48a079b7301bcd2dc31ca7357ce17dacd1acc128f21b760d8e2b0100000000fdffffff0200ca9a3b0000000017a91408e827321d3bb8d3bf74d8c6891910dbaaffc93787f0f2701802000000160014bc4248d12aab52833c9ae745349b5a65f673cee50247304402201a9c263e7e2cf00a085d13beb36738fa47529e918c1bd05cbd17b92a4d1c9d9d02205fc1f9c6b197da4a37e7085cdc8ba082676dd61d5abb77ae89f44fe5b1a1867c0121030da87c54462810fe8f7453599fe54d025f3aac07937bcebfe4a0e386281f03bb00000000"

	txID, err := SendRawTransaction(signedHex, 0.1) // optional: maxFeeRate in BTC/kB
	if err != nil {
		log.Fatalf("sendrawtransaction failed: %v", err)
	}

	fmt.Printf("Transaction broadcasted successfully. TxID: %s\n", txID)
}
