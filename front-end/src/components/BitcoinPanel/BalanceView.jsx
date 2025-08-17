import { useState } from 'react';

export default function BalanceView({ address }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [total, setTotal] = useState(null); // BTC
  const [utxos, setUtxos] = useState([]);

  async function fetchBalance() {
    if (!address) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/btc/balance', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTotal(data.total);
      setUtxos(data.utxos || []);
    } catch (e) {
      setErr(e.message);
      setTotal(null);
      setUtxos([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="btc-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 className="btc-card-title">Balance</h3>
        <button className="dex-swap-button" onClick={fetchBalance} disabled={busy || !address}>
          {busy ? 'Checking…' : 'Check Balance'}
        </button>
      </div>

      <div className="btc-mini">
        <div><strong>Address:</strong> {address || '—'}</div>
      </div>

      {err && <div className="btc-error">Error: {err}</div>}

      {total !== null && (
        <div className="btc-balance-summary">
          <strong>Total (BTC):</strong> {Number(total).toFixed(8)}
        </div>
      )}

      {utxos.length > 0 && (
        <table className="btc-table">
          <thead>
            <tr>
              <th>TXID</th>
              <th>Vout</th>
              <th>Amount (BTC)</th>
              <th>Height</th>
            </tr>
          </thead>
          <tbody>
            {utxos.map((u, i) => (
              <tr key={i}>
                <td className="mono" title={u.txid}>{u.txid.slice(0,10)}…{u.txid.slice(-8)}</td>
                <td>{u.vout}</td>
                <td>{Number(u.amount).toFixed(8)}</td>
                <td>{u.height ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total === null && !err && (
        <p className="btc-hint">Click “Check Balance” to scan UTXOs for this address.</p>
      )}
    </section>
  );
}
