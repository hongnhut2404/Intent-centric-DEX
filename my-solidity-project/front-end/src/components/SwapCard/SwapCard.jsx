import './SwapCard.css';
import { useState } from 'react';

export default function SwapCard() {
  const [fromAmount, setFromAmount] = useState('0');
  const [toAmount, setToAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const EXCHANGE_RATE = 3110.44;

  const handleFromAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || isNaN(value)) {
      setFromAmount('');
      setToAmount('0');
      return;
    }
    setFromAmount(value);
    setToAmount((parseFloat(value || 0) * EXCHANGE_RATE).toFixed(2));
  };
  const handleSubmitIntent = async () => {
    setLoading(true);
    setResponseMsg('');

    // Simulate API delay
    setTimeout(() => {
      const receiveAmount = (parseFloat(fromAmount || 0) * EXCHANGE_RATE).toFixed(2);

      // Simulated response
      const mockResponse = {
        receiveAmount,
        status: 'success',
        message: 'Intent submitted successfully!',
      };

      setResponseMsg(`${mockResponse.message} You will receive ${mockResponse.receiveAmount} DAL`);
      setLoading(false);
    }, 1000); // Simulate 1s API delay
  };

  return (
    <div className="dex-swap-card">
      <h3 className="dex-section-title">You pay</h3>
      <div className="dex-token-input">
        <input
          type="number"
          min="0"
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
          <path d="M16 10L12 14L8 10" stroke="#6200ee" strokeWidth="2" />
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

      <button
        className="dex-swap-button"
        onClick={handleSubmitIntent}
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Submit Intent'}
      </button>

      <div className="dex-rate-info">
        1 ETH = {EXCHANGE_RATE} DAL ($3,106.74)
        <div className="dex-rate-fee">$0.10: Fee</div>
      </div>

      {responseMsg && (
        <p className="dex-response-msg">
          {responseMsg}
        </p>
      )}
    </div>
  );
}
