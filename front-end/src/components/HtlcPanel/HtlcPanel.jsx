import { useMemo, useRef, useState, useEffect } from "react";
import "./HtlcPanel.css";

// Prefer relative base; allow override via Vite env
const API_ROOT = import.meta.env?.VITE_API_BASE || "/api/htlc";

export default function HtlcPanel() {
  const [buyId, setBuyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const consoleRef = useRef(null);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState("");

  useEffect(() => {
    // auto-scroll console
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [log]);

  // HtlcPanel.jsx (only the relevant changes)



  function append(line) {
    setLog((l) => (l ? `${l}\n${line}` : line));
  }

  async function call(endpoint, options = {}) {
    setBusy(true);
    append(`\n▶ ${endpoint}...`);
    try {
      const res = await fetch(`${API_ROOT}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);
      }
      const data = await res.json().catch(() => ({}));
      const out = (data.out || "").trim();
      const err = (data.err || "").trim();
      append([out, err && `[stderr]\n${err}`].filter(Boolean).join("\n") || "(no output)");
    } catch (e) {
      append(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const bodyFromBuyId = useMemo(() => {
    if (buyId === "") return {};
    const n = Number(buyId);
    return Number.isFinite(n) && n >= 0 ? { buyId: n } : {};
  }, [buyId]);

  const onFund = () => call("/fund", { method: "POST" });
  const onCreate = () => call("/create", { method: "POST", body: JSON.stringify(bodyFromBuyId) });
  const onView = () => call("/view", { method: "GET" });
  const onWithdraw = async () => {
    // Ask the user for the secret preimage
    const s = window.prompt("Enter the secret preimage (ASCII/UTF-8):");
    if (s == null || s.trim() === "") return; // cancelled or empty

    const payload = { ...bodyFromBuyId, secret: s.trim() };
    call("/withdraw", { method: "POST", body: JSON.stringify(payload) });
  };
  const onClear = () => setLog("");

  return (
    <div className="htlc-panel">
      <h2 className="dex-section-title">HTLC Ops (Solver)</h2>

      <div className="htlc-actions">
        <div className="htlc-row">
          <label>BUY_ID (optional)</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={buyId}
            onChange={(e) => setBuyId(e.target.value)}
            className="dex-token-amount"
            disabled={busy}
          />
        </div>

        <div className="htlc-row buttons">
          <button className="dex-swap-button" onClick={onFund} disabled={busy}>Fund Multisig → HTLC</button>
          <button className="dex-swap-button" onClick={onCreate} disabled={busy}>Create HTLC(s)</button>
          <button className="dex-swap-button" onClick={onView} disabled={busy}>View HTLCs</button>
          <button className="dex-swap-button" onClick={onWithdraw} disabled={busy}>Withdraw HTLC(s)</button>
          <button className="dex-swap-button" onClick={() => setShowSecretModal(true)} disabled={busy}>
            Withdraw HTLC(s)
          </button>

          <button className="dex-swap-button subtle" onClick={onClear} disabled={busy}>Clear</button>
        </div>
      </div>
      // add modal near bottom of component:
      {showSecretModal && (
        <div className="htlc-modal-overlay" onClick={() => !busy && setShowSecretModal(false)}>
          <div className="htlc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="htlc-modal-header">
              <h3>Withdraw HTLC(s)</h3>
              <button className="htlc-close" onClick={() => setShowSecretModal(false)} disabled={busy}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const payload = { ...bodyFromBuyId, secret: secretInput.trim() };
              setShowSecretModal(false);
              call("/withdraw", { method: "POST", body: JSON.stringify(payload) });
            }} className="htlc-form">
              <label>Secret preimage</label>
              <input
                type="text"
                placeholder="e.g. s--zyyrZYvligBGb"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                className="dex-token-amount"
                required
              />
              <div className="htlc-actions-row">
                <button className="dex-swap-button" type="submit" disabled={busy}>Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <pre ref={consoleRef} className="htlc-console">
        {log || "Console output will appear here…"}
      </pre>
    </div>
  );
}
