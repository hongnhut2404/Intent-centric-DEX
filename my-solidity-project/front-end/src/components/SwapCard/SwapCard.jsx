import './SwapCard.css';
import { useState } from 'react';

export default function SwapCard() {
  const [fromAmount, setFromAmount] = useState('1');
  const [toAmount, setToAmount] = useState('3110.44');

  const handleFromAmountChange = (e) => {
    const value = e.target.value;
    setFromAmount(value);
    setToAmount((parseFloat(value || 0) * 3110.44).toFixed(2));
  };

  return (
    <div className="dex-swap-card">
      <h3 className="dex-section-title">You pay</h3>
      <div className="dex-token-input">
        <input
          type="number"
          value={fromAmount}
          onChange={handleFromAmountChange}
          className="dex-token-amount"
        />
        <div className="dex-token-info">
          <span className="dex-token-value">$317.58</span>
          <span className="dex-token-name">ETH</span>
        </div>
        <p className="dex-balance-text">Balance: 3.23 ETH</p>
      </div>

      <div className="dex-swap-arrow">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M16 10L12 14L8 10" stroke="#6200ee" strokeWidth="2"/>
        </svg>
      </div>

      <h3 className="dex-section-title">You receive</h3>
      <div className="dex-token-input">
        <input
          type="number"
          value={toAmount}
          readOnly
          className="dex-token-amount"
        />
        <div className="dex-token-info">
          <span className="dex-token-value">$3106.74 (-0.34%)</span>
          <span className="dex-token-name">DAL</span>
        </div>
        <p className="dex-balance-text">Balance: 0 DAL</p>
      </div>

      <button className="dex-swap-button">SWAP</button>

      <div className="dex-rate-info">
        1 ETH = 3,110.44 DAL ($3,106.74)
        <div className="dex-rate-fee">$0.10</div>
      </div>
    </div>
  );
}