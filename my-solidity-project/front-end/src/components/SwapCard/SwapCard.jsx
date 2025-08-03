import './SwapCard.css';
import { useState } from 'react';

export default function SwapCard() {
  const [btcAmount, setBtcAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [slippage, setSlippage] = useState('');
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const calculateRate = (btc, eth) => {
    if (btc && eth && parseFloat(btc) > 0) {
      return (parseFloat(eth) / parseFloat(btc)).toFixed(6);
    }
    return null;
  };

  const handleInputChange = (setter) => (e) => {
    const value = e.target.value;
    if (value === '' || isNaN(value) || parseFloat(value) < 0) {
      setter('');
      setRate(null);
      return;
    }
    setter(value);

    const newRate = calculateRate(
      e.target.name === 'btc' ? value : btcAmount,
      e.target.name === 'eth' ? value : ethAmount
    );
    setRate(newRate);
  };

  const handleCreateIntent = async () => {
    setLoading(true);
    setResponseMsg('');

    // Simulate API call delay
    setTimeout(() => {
      const mockResponse = {
        status: 'success',
        message: 'Buy Intent created successfully!',
      };

      setResponseMsg(
        `${mockResponse.message} Rate: ${rate} ETH/BTC with ${slippage || 0}% slippage.`
      );
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="dex-swap-card">
      <h2 className="dex-section-title">Create Buy Intent</h2>

      <div className="dex-token-input">
        <label>Amount of BTC</label>
        <input
          name="btc"
          type="number"
          min="0"
          step="0.01"
          value={btcAmount}
          onChange={handleInputChange(setBtcAmount)}
          className="dex-token-amount"
        />
      </div>

      <div className="dex-token-input">
        <label>Amount of ETH</label>
        <input
          name="eth"
          type="number"
          min="0"
          step="0.01"
          value={ethAmount}
          onChange={handleInputChange(setEthAmount)}
          className="dex-token-amount"
        />
      </div>

      <div className="dex-token-input">
        <label>Slippage (%)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
          className="dex-token-amount"
        />
      </div>

      {rate && (
        <div className="dex-rate-info">
          Calculated Rate: <strong>{rate}</strong> ETH/BTC
        </div>
      )}

      <button
        className="dex-swap-button"
        onClick={handleCreateIntent}
        disabled={loading || !btcAmount || !ethAmount}
      >
        {loading ? 'Creating...' : 'Create Buy Intent'}
      </button>

      {responseMsg && (
        <p className="dex-response-msg">{responseMsg}</p>
      )}
    </div>
  );
}
