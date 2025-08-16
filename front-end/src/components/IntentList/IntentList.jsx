// IntentList.jsx
import { useEffect, useState, useRef } from 'react';
import { ethers } from 'ethers';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import intentAddress from '../../contracts/intent-matching-address.json';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import './IntentList.css';

export default function IntentList() {
  const { provider } = useLocalSigners();
  const [buyIntents, setBuyIntents] = useState([]);
  const [sellIntents, setSellIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const contractRef = useRef(null);

  const formatStatus = (statusEnum) => {
    const statuses = ['Pending', 'Partial', 'Filled', 'Cancelled'];
    const index = Number(statusEnum);
    return statuses[index] || 'Unknown';
  };

  const getContract = () => {
    if (contractRef.current) return contractRef.current;
    const c = new ethers.Contract(
      intentAddress.address,
      IntentMatchingABI.abi,
      provider
    );
    contractRef.current = c;
    return c;
  };

  const loadIntents = async () => {
    try {
      setErr('');
      setLoading(true);

      const net = await provider.getNetwork();

      const code = await provider.getCode(intentAddress.address);
      if (code === '0x') {
        throw new Error(
          `No contract code at ${intentAddress.address} on chainId ${net.chainId}. ` +
          `Check your local deploy & intent-matching-address.json.`
        );
      }

      const contract = getContract();

      const [countBuyBN, countSellBN] = await Promise.all([
        contract.intentCountBuy(),
        contract.intentCountSell(),
      ]);
      const countBuy = Number(countBuyBN);
      const countSell = Number(countSellBN);

      const buyPromises = Array.from({ length: countBuy }, (_, i) =>
        contract.getBuyIntent(i)
      );
      const sellPromises = Array.from({ length: countSell }, (_, i) =>
        contract.getSellIntent(i)
      );

      const [buyData, sellData] = await Promise.all([
        Promise.all(buyPromises),
        Promise.all(sellPromises),
      ]);

      setBuyIntents(buyData);
      setSellIntents(sellData);
    } catch (e) {
      console.error(e);
      setErr(e.reason || e.message || 'Failed to load intents');
      setBuyIntents([]);
      setSellIntents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntents();
  }, []);

  useEffect(() => {
    const contract = getContract();

    const onBuy = () => loadIntents();
    const onSell = () => loadIntents();

    try {
      contract.on('BuyIntentCreated', onBuy);
    } catch {}
    try {
      contract.on('SellIntentCreated', onSell);
    } catch {}

    return () => {
      try { contract.off('BuyIntentCreated', onBuy); } catch {}
      try { contract.off('SellIntentCreated', onSell); } catch {}
    };
  }, []);

  return (
    <div className="intent-list">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={loadIntents} className="dex-swap-button">Refresh</button>
        {loading && <span style={{ color: '#9ca3af' }}>Loading…</span>}
        {err && <span style={{ color: '#ef4444' }}>{err}</span>}
      </div>

      <div className="intent-list-component">
        <h2>Buy Intents</h2>
        {loading ? (
          <p>Loading...</p>
        ) : buyIntents.length === 0 ? (
          <p>No buy intents yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Buyer</th>
                <th>BTC</th>
                <th>ETH</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {buyIntents.map((intent, index) => (
                <tr key={`buy-${index}`}>
                  <td>{index}</td>
                  <td className="addr">{intent.buyer}</td>
                  <td>{Number(ethers.formatUnits(intent.sellAmount, 8)).toFixed(4)} BTC</td>
                  <td>{Number(ethers.formatEther(intent.minBuyAmount)).toFixed(4)} ETH</td>
                  <td>{formatStatus(intent.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="intent-list-component" style={{ marginTop: 24 }}>
        <h2>Sell Intents</h2>
        {loading ? (
          <p>Loading...</p>
        ) : sellIntents.length === 0 ? (
          <p>No sell intents yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Seller</th>
                <th>ETH</th>
                <th>BTC Expected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sellIntents.map((intent, index) => (
                <tr key={`sell-${index}`}>
                  <td>{index}</td>
                  <td className="addr">{intent.seller}</td>
                  <td>{Number(ethers.formatEther(intent.sellAmount)).toFixed(4)} ETH</td>
                  <td>{Number(ethers.formatUnits(intent.minBuyAmount, 8)).toFixed(4)} BTC</td>
                  <td>{formatStatus(intent.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
