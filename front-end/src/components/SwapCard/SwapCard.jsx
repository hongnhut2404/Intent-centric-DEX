import './SwapCard.css';
import { useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import { intentMatchingWith } from '../../web3/contract';

export default function SwapCard({ role = 'user' }) {
  const isBuy = role !== 'mm';

  const { userSigner, mmSigner } = useLocalSigners();
  const signer = isBuy ? userSigner : mmSigner;

  const [btcAmount, setBtcAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const rate = useMemo(() => {
    const b = parseFloat(btcAmount);
    const e = parseFloat(ethAmount);
    if (!isFinite(b) || !isFinite(e) || b <= 0 || e <= 0) return null;
    return isBuy ? (e / b).toFixed(6)    // ETH/BTC
                 : (b / e).toFixed(8);   // BTC/ETH
  }, [btcAmount, ethAmount, isBuy]);

  const onChangeNum = (setter) => (e) => {
    const v = e.target.value.trim();
    if (v === '') return setter('');
    const num = Number(v);
    if (!isFinite(num) || num < 0) return;
    setter(v);
  };

  const handleCreateIntent = async () => {
    setLoading(true);
    setResponseMsg('');
    try {
      if (!signer) throw new Error('No signer available for this role');
      if (!btcAmount || !ethAmount) throw new Error('Please enter both BTC and ETH amounts');

      const contract = intentMatchingWith(signer);
      const offchainId = ethers.id(`offchain-${Date.now()}`);

      if (isBuy) {
        const btcAmountParsed = ethers.parseUnits(btcAmount, 8);
        const ethAmountParsed = ethers.parseEther(ethAmount);
        const locktime = Math.floor(Date.now() / 1000) + 3600;
        const slippageValue = 0;

        const tx = await contract.createBuyIntent(
          btcAmountParsed,
          ethAmountParsed,
          locktime,
          offchainId,
          slippageValue
        );
        await tx.wait();

        setResponseMsg(
          `✅ Buy Intent created! ${btcAmount} BTC ↔ ${ethAmount} ETH`
        );
      } else {
        // SELL (MM)
        const sellAmountETH = ethers.parseEther(ethAmount);
        const minBuyAmountBTC = ethers.parseUnits(btcAmount, 8);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Optional debug: only if ABI supports it
        if (typeof contract.marketMaker === 'function') {
          const mm = await contract.marketMaker();
          console.log('marketMaker() on-chain:', mm);
        }

        const tx = await contract.createSellIntent(
          sellAmountETH,
          minBuyAmountBTC,
          deadline,
          offchainId
        );
        await tx.wait();

        setResponseMsg(
          `✅ Sell Intent created! Sell ${ethAmount} ETH for min ${btcAmount} BTC` +
          (rate ? ` (≈ ${rate} BTC/ETH)` : '') + `.`
        );
      }
    } catch (err) {
      console.error(err);
      setResponseMsg(`❌ Failed: ${err.reason || err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !btcAmount || !ethAmount;

  const btcLabel = isBuy ? 'Sell Amount BTC' : 'Buy Amount BTC';
  const ethLabel = isBuy ? 'Buy Amount ETH' : 'Sell Amount (ETH)';
  const title = isBuy ? 'Create Buy Intent' : 'Create Sell Intent';
  const rateUnit = isBuy ? 'ETH/BTC' : 'BTC/ETH';

  return (
    <div className="dex-swap-card">
      <h2 className="dex-section-title">{title}</h2>

      <div className="dex-token-input">
        <label>{btcLabel}</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={btcAmount}
          onChange={onChangeNum(setBtcAmount)}
          placeholder="0.0"
          className="dex-token-amount"
          inputMode="decimal"
        />
      </div>

      <div className="dex-token-input">
        <label>{ethLabel}</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={ethAmount}
          onChange={onChangeNum(setEthAmount)}
          placeholder="0.0"
          className="dex-token-amount"
          inputMode="decimal"
        />
      </div>

      <button className="dex-swap-button" onClick={handleCreateIntent} disabled={disabled}>
        {loading ? 'Creating…' : `Create ${isBuy ? 'Buy' : 'Sell'} Intent`}
      </button>

      {responseMsg && <p className="dex-response-msg">{responseMsg}</p>}
    </div>
  );
}
