// src/components/Header/Header.jsx
import './Header.css';

export default function Header({
  connected,
  setConnected,          // optional fallback
  activeTab,
  setActiveTab,
  onConnectClick,        // NEW: handler from App to open the role picker
}) {
  const tabs = ['Swap', 'Intents', 'Matches'];

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
            key={tab}
            type="button"
            className={`dex-nav-link ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
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
