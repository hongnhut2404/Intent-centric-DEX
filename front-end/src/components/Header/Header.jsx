// src/components/Header/Header.jsx
import './Header.css';

export default function Header({
  connected,
  setConnected,          // optional fallback
  activeTab,
  setActiveTab,
  onConnectClick,        // NEW: handler from App to open the role picker
}) {
  const tabs = [
    { id: 'Swap', label: 'Create Intent', icon: '💱' },
    { id: 'Intents', label: 'Open Intents', icon: '📋' },
    { id: 'Matches', label: 'Matched Intents', icon: '✅' },
    { id: 'HTLC', label: 'HTLC Status', icon: '🔒' }
  ];

  const handleConnect = () => {
    if (typeof onConnectClick === 'function') {
      onConnectClick();
    } else if (typeof setConnected === 'function') {
      // fallback: simple toggle
      setConnected((v) => !v);
    }
  };

  return (
    <header className="dex-header">
      <div className="dex-logo">IntentSwap</div>

      <nav className="dex-nav" aria-label="Main">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`dex-nav-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="dex-connect-button"
        onClick={handleConnect}
        aria-pressed={connected ? 'true' : 'false'}
        title={connected ? 'Connected' : 'Connect'}
      >
        {connected ? 'Connected' : 'Connect'}
      </button>
    </header>
  );
}
