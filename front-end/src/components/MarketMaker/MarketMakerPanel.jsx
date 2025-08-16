// src/components/MarketMaker/MarketMakerPanel.jsx
import { useMemo, useState } from 'react';
import { ethers } from 'ethers';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import intentAddr from '../../contracts/intent-matching-address.json';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import './MarketMakerPanel.css';

/**
 * Market Maker Swap Card — creates Sell Intent directly (no multisig).
 * Mirrors User's SwapCard UX but for ETH -> BTC.
 * Contract function signature used:
 *   createSellIntent(uint256 sellAmountETH, uint256 minBuyAmountBTC, uint256 deadline, bytes32 offchainId)
 */
export default function MarketMakerPanel() {
  const { mmSigner } = useLocalSigners();

  const [ethAmount, setEthAmount] = useState('');
  const [btcExpected, setBtcExpected] = useState('');
  const [deadlineSecs, setDeadlineSecs] = useState(3600);
  const [offchainId, setOffchainId] = useState('sell-btc-1');

  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  // Informational rate: BTC per 1 ETH (inverse of the user card)
  const rate = useMemo(() => {
    const e = parseFloat(ethAmount);
    const b = parseFloat(btcExpected);
    if (!isFinite(e) || !isFinite(b) || e <= 0) return null;
    return (b / e).toFixed(8); // BTC/ETH
  }, [ethAmount, btcExpected]);

  const onChangeNum = (setter) => (e) => {
    const v = e.target.value.trim();
    if (v === '') return setter('');
    const num = Number(v);
    if (!isFinite(num) || num < 0) return;
    setter(v);
  };

  const createSellIntent = async () => {
    setLoading(true);
    setResponseMsg('');
    try {
      if (!ethAmount || !btcExpected) {
        throw new Error('Enter ETH to sell and min BTC expected');
      }
      const contract = new ethers.Contract(intentAddr.address, IntentMatchingABI.abi, mmSigner);

      const sellAmountETH = ethers.parseEther(ethAmount);
      const minBuyAmountBTC = ethers.parseUnits(btcExpected, 8);
      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineSecs);
      const offId = ethers.encodeBytes32String(offchainId);

      const tx = await contract.createSellIntent(
        sellAmountETH,
        minBuyAmountBTC,
        deadline,
        offId
      );
      await tx.wait();

      setResponseMsg(
        `✅ Sell Intent created! ${ethAmount} ETH for min ${btcExpected} BTC` +
        (rate ? ` (≈ ${rate} BTC/ETH)` : '') + `.`
      );
      // Optionally clear:
      // setEthAmount(''); setBtcExpected('');
    } catch (e) {
      console.error(e);
      setResponseMsg(`❌ Failed: ${e.reason || e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !ethAmount || !btcExpected;

  return (
    <div className="dex-swap-card">
      <h2 className="dex-section-title">Create Sell Intent (Market Maker)</h2>

      <div className="dex-token-input">
        <label>Sell Amount (ETH)</label>
        <input
          name="eth"
          type="number"
          min="0"
          step="0.0001"
          value={ethAmount}
          onChange={onChangeNum(setEthAmount)}
          placeholder="e.g., 100"
          className="dex-token-amount"
          inputMode="decimal"
        />
      </div>

      <div className="dex-token-input">
        <label>Min BTC Expected</label>
        <input
          name="btc"
          type="number"
          min="0"
          step="0.00000001"
          value={btcExpected}
          onChange={onChangeNum(setBtcExpected)}
          placeholder="e.g., 4"
          className="dex-token-amount"
          inputMode="decimal"
        />
      </div>

      <div className="dex-token-input">
        <label>Deadline (seconds from now)</label>
        <input
          name="deadline"
          type="number"
          min="60"
          step="1"
          value={deadlineSecs}
          onChange={(e) => setDeadlineSecs(e.target.value)}
          className="dex-token-amount"
          inputMode="numeric"
        />
      </div>

      <div className="dex-token-input">
        <label>Off-chain ID</label>
        <input
          name="offchain"
          type="text"
          value={offchainId}
          onChange={(e) => setOffchainId(e.target.value)}
          placeholder="sell-btc-1"
          className="dex-token-amount"
        />
      </div>

      {rate && (
        <div className="dex-rate-info">
          Estimated Rate: <strong>{rate}</strong> BTC/ETH
        </div>
      )}

      <button className="dex-swap-button" onClick={createSellIntent} disabled={disabled}>
        {loading ? 'Creating…' : 'Create Sell Intent'}
      </button>

      {responseMsg && <p className="dex-response-msg">{responseMsg}</p>}
    </div>
  );
}
