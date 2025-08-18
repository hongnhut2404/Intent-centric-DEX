package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/btcsuite/btcd/txscript"
	"github.com/btcsuite/btcd/wire"
)

const (
	// Adjust if you keep a different relative structure
	dataDir              = "../../../data-script"
	signedRedeemJSONPath = dataDir + "/signed_redeem.json"   // { "txid": "...", "raw": "..." }
	outSecretJSONPath    = dataDir + "/revealed_secret.json" // { "secret": "...", "hex": "..." }
)

// ----- helpers to read inputs -----

type signedRedeem struct {
	Txid string `json:"txid,omitempty"`
	Raw  string `json:"raw,omitempty"` // hex-encoded raw tx
}

func readSignedRedeem() (*signedRedeem, error) {
	b, err := os.ReadFile(signedRedeemJSONPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", signedRedeemJSONPath, err)
	}
	var s signedRedeem
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, fmt.Errorf("parse %s: %w", signedRedeemJSONPath, err)
	}
	if s.Txid == "" && s.Raw == "" {
		return nil, errors.New("signed_redeem.json must have either 'txid' or 'raw'")
	}
	return &s, nil
}

func fetchRawTxWithCLI(txid string) (string, error) {
	cmd := exec.Command("bitcoin-cli", "getrawtransaction", txid, "0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("bitcoin-cli getrawtransaction failed: %v\n%s", err, out)
	}
	return strings.TrimSpace(string(out)), nil
}

// ----- script parsing -----

// extractPreimageHash scans a standard HTLC redeemScript (your success path uses OP_SHA256) and
// returns the 32-byte expected sha256(preimage) from the script.
func extractPreimageHash(redeemScript []byte) ([]byte, error) {
	// Look for OP_SHA256 <32-byte> OP_EQUALVERIFY
	for i := 0; i+34 <= len(redeemScript); i++ {
		if redeemScript[i] == txscript.OP_SHA256 && redeemScript[i+1] == 0x20 {
			h := redeemScript[i+2 : i+34]
			return h, nil
		}
	}
	return nil, errors.New("expected OP_SHA256 <32-byte> not found in redeemScript")
}

func isLikelyDER(sig []byte) bool {
	// very light heuristic: DER signatures generally start with 0x30
	return len(sig) > 0 && sig[0] == 0x30
}

// findPreimageFromScriptSig tries to locate the preimage push from the P2SH-HTLC success stack.
// Your stack (per your signer) is: [sig] [preimage] [0x01] [redeemScript]
func findPreimageFromScriptSig(scriptSig []byte, expectedHash []byte) ([]byte, []byte, error) {
	pushes, err := txscript.PushedData(scriptSig)
	if err != nil {
		return nil, nil, fmt.Errorf("decode pushes: %w", err)
	}
	if len(pushes) < 3 {
		return nil, nil, fmt.Errorf("unexpected scriptSig (need at least sig, preimage, redeemScript); got %d pushes", len(pushes))
	}

	// identify redeemScript as the LAST push (common for P2SH)
	redeemScript := pushes[len(pushes)-1]

	// Check every non-redeemScript push as candidate preimage
	for i, p := range pushes[:len(pushes)-1] {
		// skip obvious non-preimage pushes
		if isLikelyDER(p) { // signature
			continue
		}
		if len(p) == 1 && p[0] == 0x01 { // your OP_TRUE was pushed as data {0x01}
			continue
		}
		// candidate: check sha256
		d := sha256.Sum256(p)
		if bytes.Equal(d[:], expectedHash) {
			// Found preimage!
			return p, redeemScript, nil
		}
		_ = i // (for debugging if you want)
	}
	return nil, redeemScript, errors.New("no push in scriptSig matched the expected sha256(preimage)")
}

// ----- main flow -----

func main() {
	// 1) load signed_redeem.json
	sr, err := readSignedRedeem()
	if err != nil {
		fatal(err)
	}

	// 2) get raw hex
	rawHex := sr.Raw
	if rawHex == "" {
		rawHex, err = fetchRawTxWithCLI(sr.Txid)
		if err != nil {
			fatal(err)
		}
	}

	// 3) decode tx
	rawBytes, err := hex.DecodeString(strings.TrimSpace(rawHex))
	if err != nil {
		fatal(fmt.Errorf("decode raw tx hex: %w", err))
	}
	var tx wire.MsgTx
	if err := tx.Deserialize(bytes.NewReader(rawBytes)); err != nil {
		fatal(fmt.Errorf("deserialize tx: %w", err))
	}
	if len(tx.TxIn) == 0 {
		fatal(errors.New("tx has no inputs"))
	}

	// We assume the HTLC spend is input 0 (adjust if needed)
	in := tx.TxIn[0]
	scriptSig := in.SignatureScript
	if len(scriptSig) == 0 {
		fatal(errors.New("input[0] has empty SignatureScript"))
	}

	// 4) parse pushes; get redeemScript and expected sha256 from it
	pushes, err := txscript.PushedData(scriptSig)
	if err != nil {
		fatal(fmt.Errorf("PushedData(scriptSig): %w", err))
	}
	if len(pushes) < 2 {
		fatal(fmt.Errorf("unexpected scriptSig pushes: got %d", len(pushes)))
	}
	redeemScript := pushes[len(pushes)-1]
	expectedHash, err := extractPreimageHash(redeemScript)
	if err != nil {
		fatal(fmt.Errorf("extractPreimageHash: %w", err))
	}

	// 5) find the preimage in the rest of the pushes
	preimage, _, err := findPreimageFromScriptSig(scriptSig, expectedHash)
	if err != nil {
		fatal(err)
	}

	// 6) print + persist
	preHex := hex.EncodeToString(preimage)
	fmt.Println("Secret (utf-8):", string(preimage))
	fmt.Println("Secret (hex)  :", preHex)
	fmt.Printf("sha256(secret): %x\n", sha256.Sum256(preimage))

	if err := os.MkdirAll(filepath.Dir(outSecretJSONPath), 0o755); err != nil {
		fatal(fmt.Errorf("mkdir %s: %w", filepath.Dir(outSecretJSONPath), err))
	}
	out := map[string]string{
		"secret": string(preimage),
		"hex":    preHex,
	}
	b, _ := json.MarshalIndent(out, "", "  ")
	if err := os.WriteFile(outSecretJSONPath, b, 0o644); err != nil {
		fatal(fmt.Errorf("write %s: %w", outSecretJSONPath, err))
	}
	fmt.Println("Saved:", outSecretJSONPath)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "Error:", err)
	os.Exit(1)
}
