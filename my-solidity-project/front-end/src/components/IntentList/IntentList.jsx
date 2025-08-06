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

      const buyPromises = [];
      const sellPromises = [];

      for (let i = 0; i < intentCountBuy; i++) {
        buyPromises.push(contract.getBuyIntent(i));
      }

      for (let i = 0; i < intentCountSell; i++) {
        sellPromises.push(contract.getSellIntent(i));
      }

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

  return (
    <div className="intent-list">
      <h2>Buy Intents</h2>
      {loading ? <p>Loading...</p> : (
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
              <tr key={index}>
                <td>{index}</td>
                <td>{intent.buyer}</td>
                <td>{ethers.formatUnits(intent.sellAmount, 8)} BTC</td>
                <td>{ethers.formatEther(intent.minBuyAmount)} ETH</td>
                <td>{intent.slippage}%</td>
                <td>{Object.keys(intent.status)[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Sell Intents</h2>
      {loading ? <p>Loading...</p> : (
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
              <tr key={index}>
                <td>{index}</td>
                <td>{intent.seller}</td>
                <td>{ethers.formatEther(intent.sellAmount)} ETH</td>
                <td>{ethers.formatUnits(intent.minBuyAmount, 8)} BTC</td>
                <td>{Object.keys(intent.status)[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
