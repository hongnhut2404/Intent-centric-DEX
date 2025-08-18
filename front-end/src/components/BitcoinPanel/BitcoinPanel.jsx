// src/components/BitcoinPanel/BitcoinPanel.jsx
import { useEffect, useMemo, useState } from 'react';
import './BitcoinPanel.css';

const API = '/api/btc';

export default function BitcoinPanel({ btcIdentity }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [secret, setSecret] = useState("");
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [revealedHex, setRevealedHex] = useState(null);

  // Balance state
  const [balBusy, setBalBusy] = useState(false);
  const [balErr, setBalErr] = useState('');
  const [totalBTC, setTotalBTC] = useState(null);
  const [utxos, setUtxos] = useState([]);

  const role = btcIdentity?.who;           // 'alice' or 'bob'
  const addr = btcIdentity?.address || '';
  const isSolver = role === 'alice';       // Solver = Alice
  const isUser = role === 'bob';         // User = Bob

  const short = (a) => (a ? `${a.slice(0, 10)}…${a.slice(-8)}` : '—');

  function append(s) { setLog((old) => (old ? `${old}\n${s}` : s)); }

  async function callTXT(path, opts = {}) {
    setBusy(true);
    append(`\n▶ ${path}`);
    try {
      const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);
      append(text || '(no output)');
    } catch (e) {
      append(`ERROR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // ---- Actions ----
  // Both roles
  const onBalance = async () => {
    if (!addr) return;
    setBalBusy(true); setBalErr('');
    try {
      const res = await fetch(`${API}/balance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTotalBTC(Number(data.total));
      setUtxos(Array.isArray(data.utxos) ? data.utxos : []);
      append(`\nBalance: ${Number(data.total).toFixed(8)} BTC (${(data.utxos || []).length} UTXO)`);
    } catch (e) {
      setBalErr(e.message); setTotalBTC(null); setUtxos([]);
      append(`ERROR: ${e.message}`);
    } finally { setBalBusy(false); }
  };

  // Solver (Alice)
  const onGenerate = () => callTXT('/generate', { method: 'POST' }); // reads env if you set BTC_PM_SECRET/BTC_PM_AMOUNT
  const onCreateRedeem = () => callTXT('/create-redeem', { method: 'POST' });
  const onSignRedeem = () => callTXT('/sign-redeem', { method: 'POST' });
  const onScan = () => callTXT('/scan', { method: 'POST' });  // optional

  // NEW: Reveal preimage from broadcast tx (Solver)
  // Solver (Alice) actions
  const onRevealPreimage = () => callTXT('/reveal-preimage', { method: 'POST' });


  // User (Bob)
  const onVerifyOpRet = () => callTXT('/verify-opreturn', { method: 'POST' });
  const onCreateHtlc = () => callTXT('/create-htlc', { method: 'POST' });
  const onFundHtlc = () => callTXT('/fund', { method: 'POST' });

  // Clear balance when identity changes
  useEffect(() => { setTotalBTC(null); setUtxos([]); setBalErr(''); }, [addr]);

  const header = useMemo(() => {
    if (!btcIdentity) return 'Not connected';
    return `${isSolver ? 'Solver (Alice)' : 'User (Bob)'} — ${addr}`;
  }, [btcIdentity, addr, isSolver]);

  return (
    <div className="btc-panel">
      <h2 className="dex-section-title">Bitcoin</h2>

      <div className="btc-identity">{header}</div>

      {!btcIdentity ? (
        <p className="btc-hint">Click Connect and choose Alice (Solver) or Bob (User).</p>
      ) : (
        <>
          {/* Balance */}
          <section className="btc-card">
            <div className="btc-card-header">
              <h3 className="btc-card-title">Balance</h3>
              <div className="btc-card-actions">
                <button className="dex-swap-button" onClick={onBalance} disabled={balBusy || !addr}>
                  {balBusy ? 'Checking…' : 'View Balance'}
                </button>
              </div>
            </div>
            <div className="btc-mini"><strong>Address:</strong> {addr}</div>
            {balErr && <div className="btc-error">Error: {balErr}</div>}
            {totalBTC !== null && (
              <div className="btc-balance-summary">
                <strong>Total (BTC):</strong> {totalBTC.toFixed(8)}
              </div>
            )}
            {utxos.length > 0 && (
              <table className="btc-table">
                <thead>
                  <tr><th>TXID</th><th>Vout</th><th>Amount (BTC)</th><th>Height</th></tr>
                </thead>
                <tbody>
                  {utxos.map((u, i) => (
                    <tr key={`${u.txid}-${u.vout}-${i}`}>
                      <td className="mono break" title={u.txid}>{short(u.txid)}</td>
                      <td>{u.vout}</td>
                      <td>{Number(u.amount).toFixed(8)}</td>
                      <td>{u.height ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {totalBTC === null && !balErr && <p className="btc-hint">Press “View Balance” to scan UTXOs for this address.</p>}
          </section>

          {/* Role-specific */}
          <section className="btc-card">
            <div className="btc-card-header">
              <h3 className="btc-card-title">{isUser ? 'User Actions (Bob)' : 'Solver Actions (Alice)'}</h3>
            </div>
            <div className="btc-actions">
              {isUser ? (
                <>
                  <button className="dex-swap-button" onClick={onVerifyOpRet} disabled={busy}>Verify OP_RETURN</button>
                  <button className="dex-swap-button" onClick={onCreateHtlc} disabled={busy}>Create HTLC</button>
                  <button className="dex-swap-button" onClick={onFundHtlc} disabled={busy}>Fund HTLC</button>
                  <button className="dex-swap-button" onClick={onRevealPreimage} disabled={busy}>Reveal Secret (from BTC tx)</button>
                  <button className="dex-swap-button subtle" onClick={onScan} disabled={busy}>Scan HTLC (optional)</button>
                </>
              ) : (
                <>
                  <button className="dex-swap-button" onClick={onGenerate} disabled={busy}>Generate Message</button>
                  <button className="dex-swap-button" onClick={onCreateRedeem} disabled={busy}>Create Redeem Tx</button>
                  <button className="dex-swap-button" onClick={onSignRedeem} disabled={busy}>Sign Redeem Tx & Broadcast</button>
                  <button className="dex-swap-button subtle" onClick={onScan} disabled={busy}>Scan HTLC (optional)</button>
                </>
              )}
            </div>

            {/* Show revealed secret once available */}
            {revealedSecret && (
              <div className="btc-secret">
                <div><strong>Revealed Secret (utf-8):</strong></div>
                <code className="mono break">{revealedSecret}</code>
                {revealedHex && (
                  <>
                    <div style={{ marginTop: 8 }}><strong>Secret (hex):</strong></div>
                    <code className="mono break">{revealedHex}</code>
                  </>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button
                    className="dex-swap-button subtle"
                    onClick={() => navigator.clipboard.writeText(revealedSecret)}
                  >
                    Copy UTF-8
                  </button>
                  {revealedHex && (
                    <button
                      className="dex-swap-button subtle"
                      onClick={() => navigator.clipboard.writeText(revealedHex)}
                    >
                      Copy Hex
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Console */}
          <section className="btc-card">
            <div className="btc-card-header">
              <h3 className="btc-card-title">Console</h3>
              <div className="btc-card-actions">
                <button className="dex-swap-button subtle" onClick={() => setLog('')} disabled={busy}>Clear</button>
              </div>
            </div>
            <pre className="btc-console">{log || 'Console output will appear here…'}</pre>
          </section>
        </>
      )}
    </div>
  );
}
