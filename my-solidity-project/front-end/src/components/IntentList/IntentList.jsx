// src/components/IntentList/IntentList.jsx

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import intentAddress from '../../contracts/intent-matching-address.json';
import './IntentList.css';

export default function IntentList() {
  const [buyIntents, setBuyIntents] = useState([]);
  const [sellIntents, setSellIntents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadIntents = async () => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(intentAddress.address, IntentMatchingABI.abi, provider);

      const intentCountBuy = await contract.intentCountBuy();
      const intentCountSell = await contract.intentCountSell();

      const buyPromises = Array.from({ length: intentCountBuy }, (_, i) => contract.getBuyIntent(i));
      const sellPromises = Array.from({ length: intentCountSell }, (_, i) => contract.getSellIntent(i));

      const [buyData, sellData] = await Promise.all([
        Promise.all(buyPromises),
        Promise.all(sellPromises),
      ]);

      setBuyIntents(buyData);
      setSellIntents(sellData);
    } catch (error) {
      console.error('Failed to load intents:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIntents();
  }, []);

  const formatStatus = (statusEnum) => {
    // statusEnum is a BigInt (enum), convert it to readable string
    const statuses = ['Pending', 'Partial', 'Filled', 'Cancelled'];
    const index = Number(statusEnum);
    return statuses[index] || 'Unknown';
  };

  return (
    <div className="intent-list">
      <div className="intent-list-component">
        <h2>Buy Intents</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Buyer</th>
                <th>BTC</th>
                <th>ETH</th>
                <th>Slippage</th>
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
                  <td>{intent.slippage}%</td>
                  <td>{formatStatus(intent.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="intent-list-component">
        <h2>Sell Intents</h2>
        {loading ? (
          <p>Loading...</p>
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
