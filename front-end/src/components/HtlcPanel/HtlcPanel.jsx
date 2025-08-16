import { useState } from "react";
import "./HtlcPanel.css";

// Prefer relative base. Optionally override with Vite env.
const API_BASE = "/api/htlc";

export default function HtlcPanel() {
  const [buyId, setBuyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function call(endpoint, options = {}) {
    setBusy(true);
    setLog((l) => l + `\n▶ ${endpoint}...\n`);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });

      // Better error surface if server returns non-2xx
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);
      }

      const data = await res.json();
      const text =
        (data.out || "").trim() +
        (data.err && data.err.trim() ? `\n[stderr]\n${data.err.trim()}` : "");
      setLog((l) => l + (text || "(no output)") + "\n");
    } catch (e) {
      setLog((l) => l + `\nERROR: ${e.message}\n`);
    } finally {
      setBusy(false);
    }
  }

  const onFund = () => call("/fund", { method: "POST" });
  const onCreate = () =>
    call("/create", {
      method: "POST",
      body: JSON.stringify(
        buyId === "" ? {} : { buyId: Number.isFinite(+buyId) ? +buyId : undefined }
      ),
    });
  const onView = () => call("/view", { method: "GET" });

  return (
    <div className="htlc-panel">
      <h2 className="dex-section-title">HTLC Ops (Solver)</h2>

      <div className="htlc-actions">
        <button className="dex-swap-button" onClick={onFund} disabled={busy}>
          Fund Multisig → HTLC
        </button>

        <div className="htlc-row">
          <label>BUY_ID (optional)</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={buyId}
            onChange={(e) => setBuyId(e.target.value)}
            className="dex-token-amount"
          />
        </div>

        <div className="htlc-row">
          <button className="dex-swap-button" onClick={onCreate} disabled={busy}>
            Create HTLC(s)
          </button>
          <button className="dex-swap-button" onClick={onView} disabled={busy}>
            View HTLCs
          </button>
        </div>
      </div>

      <pre className="htlc-console">{log || "Console output will appear here…"}</pre>
    </div>
  );
}
