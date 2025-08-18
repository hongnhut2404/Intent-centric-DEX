import { useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import intentAddr from '../../contracts/intent-matching-address.json';
import './MatchedList.css';

export default function MatchedList() {
  const { provider, userAddress, mmAddress } = useLocalSigners();

  const [rows, setRows] = useState([]);          // enriched matches
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');   // 'all' | 'user' | 'mm'
  const contractRef = useRef(null);

  const getContract = () => {
    if (contractRef.current) return contractRef.current;
    const c = new ethers.Contract(intentAddr.address, IntentMatchingABI.abi, provider);
    contractRef.current = c;
    return c;
  };

  const loadMatches = async () => {
    try {
      setErr('');
      setLoading(true);
      const contract = getContract();

      // verify the address has code
      const code = await provider.getCode(intentAddr.address);
      if (code === '0x') {
        throw new Error(`No contract at ${intentAddr.address}. Check your local deploy.`);
      }

      const countBN = await contract.matchedTradeCount();
      const count = Number(countBN);
      if (count === 0) {
        setRows([]);
        return;
      }

      // pull all MatchedTrade structs
      const tradePromises = Array.from({ length: count }, (_, i) =>
        contract.getMatchedTrade(i)
      );
      const trades = await Promise.all(tradePromises);

      // also pull paired intents to learn buyer/seller addresses
      const enriched = await Promise.all(trades.map(async (t, id) => {
        const buy = await contract.getBuyIntent(Number(t.buyIntentId));
        const sell = await contract.getSellIntent(Number(t.sellIntentId));

        return {
          id,
          buyId: Number(t.buyIntentId),
          sellId: Number(t.sellIntentId),
          buyer: buy.buyer,
          seller: sell.seller,
          executor: t.executor,
          recipient: t.recipient,
          ethAmount: Number(ethers.formatEther(t.ethAmount)),
          btcAmount: Number(t.btcAmount) / 1e8,
          locktime: Number(t.locktime),
          timestamp: Number(t.timestamp),
        };
      }));

      setRows(enriched.reverse()); // newest first
    } catch (e) {
      console.error(e);
      setErr(e.reason || e.message || 'Failed to load matches');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    if (!provider) return;
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // auto-refresh when a new match is emitted
  useEffect(() => {
    const c = getContract();
    const onMatch = () => loadMatches();
    try { c.on('TradeMatched', onMatch); } catch { }
    return () => { try { c.off('TradeMatched', onMatch); } catch { } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
  const fmtTime = (sec) => new Date(sec * 1000).toLocaleString();

  const filtered = useMemo(() => {
    if (filter === 'user') {
      return rows.filter(r => r.buyer?.toLowerCase() === userAddress?.toLowerCase());
    }
    if (filter === 'mm') {
      return rows.filter(r => r.seller?.toLowerCase() === mmAddress?.toLowerCase());
    }
    // 'all'
    return rows;
  }, [rows, filter, userAddress, mmAddress]);

  return (
    <div className="matches">


      {filtered.length === 0 && !loading ? (
        <p className="matches-empty">No matched trades yet.</p>
      ) : (
        <table className="matches-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Buy#</th>
              <th>Sell#</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>ETH</th>
              <th>BTC</th>
              <th>Matched At</th>
              <th>Executor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.buyId}</td>
                <td>{r.sellId}</td>
                <td className="addr" title={r.buyer}>{short(r.buyer)}</td>
                <td className="addr" title={r.seller}>{short(r.seller)}</td>
                <td>{r.ethAmount.toFixed(4)}</td>
                <td>{r.btcAmount.toFixed(4)}</td>
                <td title={fmtTime(r.timestamp)}>{fmtTime(r.timestamp)}</td>
                <td className="addr" title={r.executor}>{short(r.executor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="matches-toolbar">
        <button className="dex-swap-button" onClick={loadMatches}>Refresh</button>

        {err && <span className="matches-err">{err}</span>}
        {loading && <span className="matches-loading">Loading…</span>}
      </div>
    </div>
  );
}
