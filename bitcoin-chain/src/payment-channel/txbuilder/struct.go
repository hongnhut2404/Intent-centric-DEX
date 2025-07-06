package txbuilder

type KeyInfo struct {
	PrivKey string `json:"privkey"`
	PubKey  string `json:"pubkey"`
	Address string `json:"address"`
}

type HTLC struct {
	Txid         string  `json:"txid,omitempty"`
	Vout         uint32  `json:"vout"`
	Amount       float64 `json:"amount,omitempty"`
	RedeemScript string  `json:"redeemScript,omitempty"`
}

type ChannelState struct {
	AliceBalance float64 `json:"aliceBalance"`
	BobBalance   float64 `json:"bobBalance"`
}

type State struct {
	Alice       *KeyInfo      `json:"alice"`
	Bob         *KeyInfo      `json:"bob"`
	HTLC        *HTLC         `json:"htlc,omitempty"`
	Channel     *ChannelState `json:"channel,omitempty"`
	Commitments []Commitment  `json:"commitments,omitempty"`
}

type Commitment struct {
	ID           int     `json:"id"`
	AliceBalance float64 `json:"aliceBalance"`
	BobBalance   float64 `json:"bobBalance"`
	SignedTx     string  `json:"signedTx"`
	Timestamp    string  `json:"timestamp"`
}

type FundInput struct {
	Address string  `json:"address"`
	Amount  float64 `json:"amount"`
}

type UTXORecord struct {
	TxID         string  `json:"txid"`
	Vout         uint32  `json:"vout"`
	Amount       float64 `json:"amount"`
	RedeemScript string  `json:"redeemScript,omitempty"` // filled later
}

type FundData struct {
	Address string  `json:"address"`
	Amount  float64 `json:"amount"`
}

type BobKey struct {
	PrivKey string `json:"privkey"`
	PubKey  string `json:"pubkey"`
	Address string `json:"address"`
}

type ScanTxOutResult struct {
	Unspents []struct {
		TxID         string  `json:"txid"`
		Vout         uint32  `json:"vout"`
		ScriptPubKey string  `json:"scriptPubKey"`
		Amount       float64 `json:"amount"`
		Height       int64   `json:"height"`
	} `json:"unspents"`
	TotalAmount float64 `json:"total_amount"`
}
