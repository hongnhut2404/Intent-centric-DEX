import { useMemo, useState } from "react";
import "./HtlcPanel.css";

const API_BASE = "/api/htlc";

const ACTIONS = {
  fund: { title: "Fund Multisig → HTLC" },
  create: { title: "Create HTLC(s)" },
  view: { title: "View HTLCs" },
  withdraw: { title: "Withdraw HTLC(s)" },
};

export default function HtlcPanel() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  // modal state
  const [open, setOpen] = useState(null); // 'fund' | 'create' | 'view' | 'withdraw' | null

  // form state per action
  const [fundAmount, setFundAmount] = useState("");   // ETH to fund (optional; your fund.js may ignore)
  const [buyIdCreate, setBuyIdCreate] = useState(""); // optional
  const [buyIdView, setBuyIdView] = useState("");     // optional (server can ignore)
  const [buyIdWithdraw, setBuyIdWithdraw] = useState("");// optional

  function appendLog(s) {
    setLog((l) => (l ? `${l}\n${s}` : s));
  }

  async function call(endpoint, options = {}) {
    setBusy(true);
    appendLog(`\n▶ ${endpoint}...`);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        appendLog(`ERROR: HTTP ${res.status} ${res.statusText}\n${text}`);
        return;
      }
      const data = await res.json();
      const text =
        (data.out || "").trim() +
        (data.err ? `\n[stderr]\n${data.err.trim()}` : "");
      appendLog(text || "(no output)");
    } catch (e) {
      appendLog(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
      setOpen(null);
    }
  }

  // submit handlers
  const onSubmitFund = (e) => {
    e.preventDefault();
    // If you later need to send an amount, pass it in body; current fund.js often just tops up.
    const body =
      fundAmount && Number.isFinite(+fundAmount)
        ? { amountEth: fundAmount }
        : {};
    call("/fund", { method: "POST", body: JSON.stringify(body) });
  };

  const onSubmitCreate = (e) => {
    e.preventDefault();
    const body =
      buyIdCreate === ""
        ? {}
        : { buyId: Number.isFinite(+buyIdCreate) ? +buyIdCreate : undefined };
    call("/create", { method: "POST", body: JSON.stringify(body) });
  };

  const onSubmitView = (e) => {
    e.preventDefault();
    // If you add filtering server-side, switch to POST with body. For now we GET.
    call("/view", { method: "GET" });
  };

  const onSubmitWithdraw = (e) => {
    e.preventDefault();
    const body =
      buyIdWithdraw === ""
        ? {}
        : { buyId: Number.isFinite(+buyIdWithdraw) ? +buyIdWithdraw : undefined };
    call("/withdraw", { method: "POST", body: JSON.stringify(body) });
  };

  const modalTitle = useMemo(() => (open ? ACTIONS[open].title : ""), [open]);

  return (
    <div className="htlc-panel">
      <h2 className="dex-section-title">HTLC Ops (Solver)</h2>

      {/* four button toolbar */}
      <div className="htlc-toolbar">
        <button className="dex-swap-button" onClick={() => setOpen("fund")} disabled={busy}>
          Fund
        </button>
        <button className="dex-swap-button" onClick={() => setOpen("create")} disabled={busy}>
          Create
        </button>
        <button className="dex-swap-button" onClick={() => setOpen("view")} disabled={busy}>
          View
        </button>
        <button className="dex-swap-button" onClick={() => setOpen("withdraw")} disabled={busy}>
          Withdraw
        </button>
      </div>

      {/* modal */}
      {open && (
        <div className="htlc-modal-overlay" onClick={() => !busy && setOpen(null)}>
          <div className="htlc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="htlc-modal-header">
              <h3>{modalTitle}</h3>
              <button className="htlc-close" onClick={() => setOpen(null)} disabled={busy}>
                ×
              </button>
            </div>

            {open === "fund" && (
              <form onSubmit={onSubmitFund} className="htlc-form">
                <label>Amount (ETH) <span className="muted">(optional)</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="e.g. 50"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="dex-token-amount"
                />
                <div className="htlc-actions-row">
                  <button className="dex-swap-button" type="submit" disabled={busy}>
                    Run Fund
                  </button>
                </div>
              </form>
            )}

            {open === "create" && (
              <form onSubmit={onSubmitCreate} className="htlc-form">
                <label>BUY_ID <span className="muted">(optional)</span></label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={buyIdCreate}
                  onChange={(e) => setBuyIdCreate(e.target.value)}
                  className="dex-token-amount"
                />
                <div className="htlc-actions-row">
                  <button className="dex-swap-button" type="submit" disabled={busy}>
                    Run Create
                  </button>
                </div>
              </form>
            )}

            {open === "view" && (
              <form onSubmit={onSubmitView} className="htlc-form">
                <p className="muted" style={{ marginTop: 0 }}>
                  This will list HTLCs from the contracts. No input required.
                </p>
                <div className="htlc-actions-row">
                  <button className="dex-swap-button" type="submit" disabled={busy}>
                    Run View
                  </button>
                </div>
              </form>
            )}

            {open === "withdraw" && (
              <form onSubmit={onSubmitWithdraw} className="htlc-form">
                <label>BUY_ID <span className="muted">(optional)</span></label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={buyIdWithdraw}
                  onChange={(e) => setBuyIdWithdraw(e.target.value)}
                  className="dex-token-amount"
                />
                <div className="htlc-actions-row">
                  <button className="dex-swap-button" type="submit" disabled={busy}>
                    Run Withdraw
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <pre className="htlc-console">{log || "Console output will appear here…"}</pre>
    </div>
  );
}
