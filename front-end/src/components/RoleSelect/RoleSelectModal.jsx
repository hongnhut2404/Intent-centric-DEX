import './RoleSelectModal.css';

export default function RoleSelectModal({ userAddress, mmAddress, onClose, onPick }) {
  const short = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : '—');

  return (
    <div className="role-overlay" onClick={onClose}>
      <div className="role-card" onClick={(e) => e.stopPropagation()}>
        <h3>Select a Role</h3>
        <p className="role-sub">Choose which signer to use for this session.</p>

        <div className="role-grid">
          <button className="role-option" onClick={() => onPick('User')}>
            <div className="role-title">User</div>
            <div className="role-desc">Create <strong>Buy Intents</strong></div>
            <div className="role-addr">{short(userAddress)}</div>
          </button>

          <button className="role-option" onClick={() => onPick('MM')}>
            <div className="role-title">Market Maker</div>
            <div className="role-desc">Create/confirm <strong>Sell Intents</strong> via Multisig</div>
            <div className="role-addr">{short(mmAddress)}</div>
          </button>
        </div>

        <button className="role-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
