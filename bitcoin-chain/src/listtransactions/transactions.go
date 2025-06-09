package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
)

type ListTransactionsParams struct {
	Label            string `default:"*"`
	Count            int    `default:"10"`
	Skip             int    `default:"0"`
	IncludeWatchOnly *bool  // we'll handle default manually since tag parsing doesn't support bool
}

type Transaction struct {
	Address           string   `json:"address"`
	ParentDescs       []string `json:"parent_descs"`
	Category          string   `json:"category"`
	Amount            float64  `json:"amount"`
	Label             string   `json:"label"`
	Vout              int      `json:"vout"`
	Abandoned         bool     `json:"abandoned"`
	Confirmations     int      `json:"confirmations"`
	Generated         bool     `json:"generated"`
	BlockHash         string   `json:"blockhash"`
	BlockHeight       int      `json:"blockheight"`
	BlockIndex        int      `json:"blockindex"`
	BlockTime         int64    `json:"blocktime"`
	TxID              string   `json:"txid"`
	WtxID             string   `json:"wtxid"`
	WalletConflicts   []string `json:"walletconflicts"`
	Time              int64    `json:"time"`
	TimeReceived      int64    `json:"timereceived"`
	BIP125Replaceable string   `json:"bip125-replaceable"`
}

func ListTransactions(params ListTransactionsParams) ([]Transaction, error) {
	// Reflect-based defaults
	t := reflect.TypeOf(params)
	v := reflect.ValueOf(&params).Elem()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		def := field.Tag.Get("default")
		val := v.Field(i)

		if val.Kind() == reflect.String && val.String() == "" {
			val.SetString(def)
		} else if val.Kind() == reflect.Int && val.Int() == 0 {
			intVal, _ := strconv.Atoi(def)
			val.SetInt(int64(intVal))
		}
	}

	// Default for IncludeWatchOnly
	includeWatchOnly := false
	if params.IncludeWatchOnly != nil {
		includeWatchOnly = *params.IncludeWatchOnly
	}

	// Prepare parameters
	rpcParams := []interface{}{params.Label, params.Count, params.Skip, includeWatchOnly}

	raw, err := callRPC("listtransactions", rpcParams)
	if err != nil {
		return nil, err
	}

	var txs []Transaction
	if err := json.Unmarshal(raw, &txs); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return txs, nil
}
