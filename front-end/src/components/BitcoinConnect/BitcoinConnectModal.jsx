import { useEffect, useState } from "react";
import "./BitcoinConnectModal.css";

export default function BitcoinConnectModal({ onClose, onPick }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({ alice: null, bob: null });
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/btc/state");
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) throw new Error(data.error || "Failed to load BTC state");
        setState({ alice: data.alice, bob: data.bob });
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-8)}` : "—");

  return (
    <div className="role-overlay" onClick={onClose}>
      <div className="role-card" onClick={(e) => e.stopPropagation()}>
        <h3>Connect as</h3>
        <p className="role-sub">Choose a pre-initialized BTC identity (from CLI).</p>

        {loading ? (
          <div className="role-sub">Loading…</div>
        ) : err ? (
          <div className="role-sub" style={{ color: "#ef4444" }}>{err}</div>
        ) : (
          <div className="role-grid">
            <button
              className="role-option"
              onClick={() => onPick({ kind: "btc", who: "alice", address: state.alice?.Address })}
              disabled={!state.alice}
              title={!state.alice ? "Initialize alice via CLI first" : ""}
            >
              <div className="role-title">Alice (User)</div>
              <div className="role-desc">Priv/Pub/Addr loaded from state</div>
              <div className="role-addr">{state.alice ? short(state.alice.Address) : "not found"}</div>
            </button>

            <button
              className="role-option"
              onClick={() => onPick({ kind: "btc", who: "bob", address: state.bob?.Address })}
              disabled={!state.bob}
              title={!state.bob ? "Initialize bob via CLI first" : ""}
            >
              <div className="role-title">Bob (Solver)</div>
              <div className="role-desc">Priv/Pub/Addr loaded from state</div>
              <div className="role-addr">{state.bob ? short(state.bob.Address) : "not found"}</div>
            </button>
          </div>
        )}

        <button className="role-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
