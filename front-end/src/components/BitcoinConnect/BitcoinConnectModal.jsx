import { useEffect, useState } from "react";
import "./BitcoinConnectModal.css";

export default function BitcoinConnectModal({ onClose, onPick }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [alice, setAlice] = useState(null);
  const [bob, setBob] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const res = await fetch("/api/btc/state");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // server returns: { ok: true, alice, bob }
        setAlice(data.alice || null);
        setBob(data.bob || null);
      } catch (e) {
        setErr(e.message || "Failed to load state");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="btc-modal-overlay" onClick={onClose}>
      <div className="btc-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="btc-modal-title">Select Bitcoin Role</h2>

        {loading ? (
          <div className="btc-modal-note">Loading…</div>
        ) : err ? (
          <div className="btc-modal-error">Error: {err}</div>
        ) : (
          <div className="btc-role-grid">
            <button
              className="btc-role-btn"
              disabled={!alice}
              title={!alice ? "Alice not initialized yet" : "Use Alice (Solver)"}
              onClick={() =>
                onPick({
                  who: "alice",               // Solver
                  roleLabel: "Solver",
                  address: alice.address,
                })
              }
            >
              <div className="btc-role-top">Solver (Alice)</div>
              <div className="btc-role-addr">
                {alice ? alice.address : "— not found —"}
              </div>
            </button>

            <button
              className="btc-role-btn"
              disabled={!bob}
              title={!bob ? "Bob not initialized yet" : "Use Bob (User)"}
              onClick={() =>
                onPick({
                  who: "bob",                 // User
                  roleLabel: "User",
                  address: bob.address,
                })
              }
            >
              <div className="btc-role-top">User (Bob)</div>
              <div className="btc-role-addr">
                {bob ? bob.address : "— not found —"}
              </div>
            </button>
          </div>
        )}

        <div className="btc-modal-actions">
          <button className="btc-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
