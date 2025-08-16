import { useEffect } from 'react';
import './RoleSelectModal.css';

export default function RoleSelectModal({ userAddress, mmAddress, onClose, onPick }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const short = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : '—');

  return (
    <div
      className="role-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="role-modal-title"
    >
      <div className="role-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="role-modal-title">Select a role</h3>
        <p className="role-sub">Choose which local account you want to act as.</p>

        <div className="role-grid">
          <button
            type="button"
            className="role-option"
            onClick={() => onPick?.('User')}
          >
            <div className="role-title">User</div>
            <div className="role-desc">Creates <strong>Buy Intents</strong> (BTC → ETH).</div>
            <div className="role-addr">{userAddress || '—'} {userAddress && `(${short(userAddress)})`}</div>
          </button>

          <button
            type="button"
            className="role-option"
            onClick={() => onPick?.('MM')}
          >
            <div className="role-title">Market Maker</div>
            <div className="role-desc">Creates <strong>Sell Intents</strong> (ETH → BTC).</div>
            <div className="role-addr">{mmAddress || '—'} {mmAddress && `(${short(mmAddress)})`}</div>
          </button>
        </div>

        <button type="button" className="role-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
