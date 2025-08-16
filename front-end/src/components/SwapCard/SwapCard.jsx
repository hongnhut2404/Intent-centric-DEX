// src/components/SwapCard/SwapCard.jsx
import './SwapCard.css';
import { useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import { intentMatchingWith } from '../../web3/contract';

export default function SwapCard() {
  const { userSigner } = useLocalSigners();

  const [btcAmount, setBtcAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const rate = useMemo(() => {
    const b = parseFloat(btcAmount);
    const e = parseFloat(ethAmount);
    if (!isFinite(b) || !isFinite(e) || b <= 0) return null;
    return (e / b).toFixed(6);
  }, [btcAmount, ethAmount]);

  const onChangeNum = (setter, name) => (e) => {
    const v = e.target.value.trim();
    if (v === '') return setter('');
    const num = Number(v);
    if (!isFinite(num) || num < 0) return; // ignore invalid
    // small clamp to avoid scientific notation issues
    setter(v);
  };

  const handleCreateIntent = async () => {
    setLoading(true);
    setResponseMsg('');
    try {
      if (!btcAmount || !ethAmount) throw new Error('Enter BTC and ETH amounts');

      const contract = intentMatchingWith(userSigner);

      const btcAmountParsed = ethers.parseUnits(btcAmount, 8); // BTC (off-chain units)
      const ethAmountParsed = ethers.parseEther(ethAmount);    // ETH (wei)
      const locktime = Math.floor(Date.now() / 1000) + 3600;   // +1 hour
      const offchainId = ethers.id(`offchain-${Date.now()}`);
      const slippageValue = 0; // contract expects a param; we pass 0

      const tx = await contract.createBuyIntent(
        btcAmountParsed,
        ethAmountParsed,
        locktime,
        offchainId,
        slippageValue
      );
      await tx.wait();

      setResponseMsg(
        `Buy Intent created! ${btcAmount} BTC for ${ethAmount} ETH (rate ${rate ?? '—'} ETH/BTC).`
      );
      // Optional: clear inputs
      // setBtcAmount('');
      // setEthAmount('');
    } catch (err) {
      console.error(err);
      setResponseMsg(`Failed to create Buy Intent: ${err.reason || err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !btcAmount || !ethAmount;

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
          onChange={onChangeNum(setBtcAmount, 'btc')}
          placeholder="0.0"
          className="dex-token-amount"
          inputMode="decimal"
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
          onChange={onChangeNum(setEthAmount, 'eth')}
          placeholder="0.0"
          className="dex-token-amount"
          inputMode="decimal"
        />
      </div>

      {rate && (
        <div className="dex-rate-info">
          Calculated Rate:&nbsp;<strong>{rate}</strong>&nbsp;ETH/BTC
        </div>
      )}

      <button
        className="dex-swap-button"
        onClick={handleCreateIntent}
        disabled={disabled}
      >
        {loading ? 'Creating…' : 'Create Buy Intent'}
      </button>

      {responseMsg && <p className="dex-response-msg">{responseMsg}</p>}
    </div>
  );
}
