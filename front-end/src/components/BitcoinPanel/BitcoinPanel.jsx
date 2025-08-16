import "./BitcoinPanel.css";
import { useState } from "react";

const API_BASE = "/api/btc";

export default function BitcoinPanel({ btcIdentity }) {
  // btcIdentity: { who: 'alice' | 'bob', address: string } or null
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function call(endpoint, body) {
    setBusy(true);
    setLog((l) => l + `\n▶ ${endpoint}${body ? " " + JSON.stringify(body) : ""}\n`);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setLog((l) => l + `ERROR: HTTP ${res.status} ${res.statusText}\n${text}\n`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const text =
        (data.out || "").trim() +
        (data.err ? `\n[stderr]\n${(data.err || "").trim()}` : "");
      setLog((l) => l + (text || "(no output)") + "\n");
    } catch (e) {
      setLog((l) => l + `ERROR: ${e.message}\n`);
    } finally {
      setBusy(false);
    }
  }

  const isUser = btcIdentity?.who === "alice";
  const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-8)}` : "—");

  // Actions (same as before)
  const onInitUser      = () => call("/init",          { who: "alice" });
  const onGenerateMsg   = () => call("/generate");
  const onVerifyOpRet   = () => call("/verify");
  const onCreateHtlcBTC = () => call("/create-htlc");
  const onFundHtlcBTC   = () => call("/fund");
  const onInitSolver    = () => call("/init", { who: "bob" });
  const onScanHtlc      = () => call("/scan");
  const onCreateRedeem  = () => call("/create-redeem");
  const onSignRedeem    = () => call("/sign-redeem");

  return (
    <div className="btc-page">
      <div className="btc-header-row">
        <h2 className="dex-section-title">Bitcoin Flow</h2>
        <div className="btc-banner">
          <div><strong>Connected:</strong> {btcIdentity ? `${btcIdentity.who}` : "—"}</div>
          <div><strong>Address:</strong> {btcIdentity ? short(btcIdentity.address) : "—"}</div>
          {!btcIdentity && <div className="hint">Click Connect to choose Alice or Bob (pre-initialized via CLI)</div>}
        </div>
      </div>

      <div className="btc-grid">
        <section className="btc-card">
          <h3 className="btc-card-title">{isUser ? "User path (Alice)" : "Solver path (Bob)"}</h3>

          {isUser ? (
            <ol className="btc-steps">
              <li className="step-line">
                <div>
                  <div className="step-title">Initialize User wallet (alice)</div>
                  <div className="step-sub">go run main.go init alice</div>
                </div>
                <button className="dex-swap-button" onClick={onInitUser} disabled={busy}>Init</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Generate payment message</div>
                  <div className="step-sub">go run main.go generate-message</div>
                </div>
                <button className="dex-swap-button" onClick={onGenerateMsg} disabled={busy}>Generate</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Verify OP_RETURN + signature</div>
                  <div className="step-sub">go run main.go verify-opreturn …</div>
                </div>
                <button className="dex-swap-button" onClick={onVerifyOpRet} disabled={busy}>Verify</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Create Bitcoin HTLC</div>
                  <div className="step-sub">go run ../htlc/create-htlc/*.go</div>
                </div>
                <button className="dex-swap-button" onClick={onCreateHtlcBTC} disabled={busy}>Create HTLC</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Fund the HTLC</div>
                  <div className="step-sub">go run ../fund/*.go</div>
                </div>
                <button className="dex-swap-button" onClick={onFundHtlcBTC} disabled={busy}>Fund</button>
              </li>
            </ol>
          ) : (
            <ol className="btc-steps">
              <li className="step-line">
                <div>
                  <div className="step-title">Initialize Solver wallet (bob)</div>
                  <div className="step-sub">go run main.go init bob</div>
                </div>
                <button className="dex-swap-button" onClick={onInitSolver} disabled={busy}>Init</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Scan HTLC address</div>
                  <div className="step-sub">go run ../scan-htlc/*.go</div>
                </div>
                <button className="dex-swap-button" onClick={onScanHtlc} disabled={busy}>Scan</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Create redeem transaction</div>
                  <div className="step-sub">go run ../create-redeem/*.go</div>
                </div>
                <button className="dex-swap-button" onClick={onCreateRedeem} disabled={busy}>Create Redeem</button>
              </li>
              <li className="step-line">
                <div>
                  <div className="step-title">Sign redeem tx (with secret)</div>
                  <div className="step-sub">go run ../sign-redeem/*.go</div>
                </div>
                <button className="dex-swap-button" onClick={onSignRedeem} disabled={busy}>Sign Redeem</button>
              </li>
            </ol>
          )}
        </section>

        <section className="btc-card">
          <h3 className="btc-card-title">Console</h3>
          <pre className="btc-console">{log || "Console output will appear here…"}</pre>
          <div className="btc-console-actions">
            <button className="dex-swap-button subtle" onClick={() => setLog("")} disabled={busy}>Clear</button>
          </div>
        </section>
      </div>
    </div>
  );
}
