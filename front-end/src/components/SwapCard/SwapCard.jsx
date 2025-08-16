import './SwapCard.css';
import { useState } from 'react';
import { ethers } from 'ethers';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import intentAddress from '../../contracts/intent-matching-address.json';

export default function SwapCard() {
  const [btcAmount, setBtcAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [slippage, setSlippage] = useState('');
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const calculateRate = (btc, eth) => {
    if (btc && eth && parseFloat(btc) > 0) {
      return (parseFloat(eth) / parseFloat(btc)).toFixed(2);
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

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        intentAddress.address,
        IntentMatchingABI.abi,
        signer
      );

      const btcAmountParsed = ethers.parseUnits(btcAmount, 8); // BTC: 8 decimals (off-chain)
      const ethAmountParsed = ethers.parseEther(ethAmount);     // ETH: 18 decimals
      const locktime = Math.floor(Date.now() / 1000) + 3600;     // 1 hour later
      const slippageValue = parseInt(slippage || '0');
      const offchainId = ethers.id(`offchain-${Date.now()}`);

      const tx = await contract.createBuyIntent(
        btcAmountParsed,
        ethAmountParsed,
        locktime,
        offchainId,
        slippageValue
      );

      await tx.wait();

      setResponseMsg(
        `Buy Intent created successfully! Rate: ${rate} ETH/BTC with ${slippage || 0}% slippage.`
      );
    } catch (err) {
      console.error(err);
      setResponseMsg('Failed to create Buy Intent.');
    }

    setLoading(false);
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
