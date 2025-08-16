// src/components/MarketMaker/MarketMakerPanel.jsx
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import IntentMatchingABI from '../../contracts/IntentMatching.json';
import MultisigABI from '../../contracts/MultisigWallet.json';
import intentAddr from '../../contracts/intent-matching-address.json';
import { useLocalSigners } from '../../web3/LocalSignerContext';
import './MarketMakerPanel.css';

export default function MarketMakerPanel() {
  const { mmSigner, provider } = useLocalSigners();
  const [sellEth, setSellEth] = useState('4.0');
  const [minBtc, setMinBtc] = useState('0.20');
  const [deadlineSecs, setDeadlineSecs] = useState(3600);
  const [offchainId, setOffchainId] = useState('sell-btc-1');

  const [multisigAddress, setMultisigAddress] = useState('');
  const [msg, setMsg] = useState('');
  const [txIdInput, setTxIdInput] = useState('');
  const [txs, setTxs] = useState([]);

  const loadMultisigAddress = async () => {
    const intent = new ethers.Contract(intentAddr.address, IntentMatchingABI.abi, provider);
    const m = await intent.multisigWallet();
    if (!m || m === ethers.ZeroAddress) throw new Error('Multisig not set on-chain');
    setMultisigAddress(m);
    return m;
  };

  const submitCreateSellIntent = async () => {
    try {
      setMsg('');
      const m = multisigAddress || (await loadMultisigAddress());
      const multisig = new ethers.Contract(m, MultisigABI.abi, mmSigner);

      const iface = new ethers.Interface(IntentMatchingABI.abi);
      const sellAmountETH = ethers.parseEther(sellEth);
      const minBuyAmountBTC = ethers.parseUnits(minBtc, 8);
      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineSecs);
      const offId = ethers.encodeBytes32String(offchainId);

      const data = iface.encodeFunctionData('createSellIntent', [
        sellAmountETH,
        minBuyAmountBTC,
        deadline,
        offId,
      ]);

      const tx = await multisig.submitTransaction(intentAddr.address, 0, data);
      const rc = await tx.wait();
      setMsg(`Submitted multisig tx. Hash: ${rc.transactionHash}`);
    } catch (e) {
      console.error(e);
      setMsg(e.reason || e.message || 'Submit failed');
    }
  };

  const confirmTx = async () => {
    try {
      setMsg('');
      const m = multisigAddress || (await loadMultisigAddress());
      const multisig = new ethers.Contract(m, MultisigABI.abi, mmSigner);
      const tx = await multisig.confirmTransaction(Number(txIdInput));
      const rc = await tx.wait();
      setMsg(`Confirmed tx #${txIdInput}. Hash: ${rc.transactionHash}`);
    } catch (e) {
      console.error(e);
      setMsg(e.reason || e.message || 'Confirm failed');
    }
  };

  const loadTxs = async () => {
    try {
      setMsg('');
      const m = multisigAddress || (await loadMultisigAddress());
      const multisig = new ethers.Contract(m, MultisigABI.abi, mmSigner);

      let list = [];
      if (multisig.getTransactionCount && multisig.transactions) {
        const count = Number(await multisig.getTransactionCount());
        const from = Math.max(0, count - 10);
        for (let i = from; i < count; i++) {
          try {
            const tx = await multisig.transactions(i);
            list.push({ id: i, ...tx });
          } catch {}
        }
      }
      setTxs(list);
    } catch (e) {
      console.error(e);
      setMsg(e.message || 'Failed to load multisig txs');
    }
  };

  useEffect(() => {
    (async () => { try { await loadMultisigAddress(); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mm-panel">
      <h2>Market Maker — Create Sell Intent (via Multisig)</h2>

      <div className="mm-row">
        <label>Sell Amount (ETH)</label>
        <input value={sellEth} onChange={e => setSellEth(e.target.value)} type="number" min="0" step="0.0001" />
      </div>
      <div className="mm-row">
        <label>Min BTC Expected</label>
        <input value={minBtc} onChange={e => setMinBtc(e.target.value)} type="number" min="0" step="0.00000001" />
      </div>
      <div className="mm-row">
        <label>Deadline (seconds from now)</label>
        <input value={deadlineSecs} onChange={e => setDeadlineSecs(e.target.value)} type="number" min="60" />
      </div>
      <div className="mm-row">
        <label>Off-chain ID</label>
        <input value={offchainId} onChange={e => setOffchainId(e.target.value)} placeholder="sell-btc-1" />
      </div>

      <div className="mm-actions">
        <button className="dex-swap-button" onClick={submitCreateSellIntent}>
          Submit CreateSellIntent (Multisig)
        </button>
      </div>

      <hr className="mm-hr" />

      <h3>Confirm / Inspect Multisig Transactions</h3>
      <div className="mm-row">
        <label>Tx ID</label>
        <input value={txIdInput} onChange={e => setTxIdInput(e.target.value)} type="number" min="0" />
        <button className="dex-swap-button" onClick={confirmTx}>Confirm Tx</button>
      </div>

      <div className="mm-actions">
        <button className="dex-swap-button" onClick={loadTxs}>Load Recent Multisig Txs</button>
      </div>

      {multisigAddress && (<p className="mm-info">Multisig: {multisigAddress}</p>)}
      {msg && <p className="mm-msg">{msg}</p>}

      {txs.length > 0 && (
        <table className="mm-table">
          <thead>
            <tr>
              <th>ID</th><th>Destination</th><th>Value (ETH)</th><th>Executed</th>
            </tr>
          </thead>
          <tbody>
            {txs.map(tx => (
              <tr key={tx.id}>
                <td>{tx.id}</td>
                <td className="addr">{tx.destination || tx.to}</td>
                <td>{tx.value ? ethers.formatEther(tx.value) : '0'}</td>
                <td>{String(tx.executed ?? false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
