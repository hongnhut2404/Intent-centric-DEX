// src/components/Header/Header.jsx
import './Header.css';

export default function Header({
  chain,            // 'eth' | 'btc'
  setChain,
  connected,
  setConnected,
  activeTab,
  setActiveTab,
  onConnectClick,
}) {
  const ethTabs = ['Swap', 'Intents', 'Matches', 'HTLC'];

  const handleConnect = () => {
    if (typeof onConnectClick === 'function') onConnectClick();
    else if (typeof setConnected === 'function') setConnected((v) => !v);
  };

  const handleSwitch = () => {
    setChain(chain === 'eth' ? 'btc' : 'eth');
  };

  return (
    <header className="dex-header">
      <div className="dex-logo">IntentSwap</div>

      {/* ETH-only sub-nav in center */}
      {chain === 'eth' && (
        <nav className="dex-nav" aria-label="Main">
          {ethTabs.map((tab) => (
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
      )}

      {/* Right side controls */}
      <div className="dex-controls">
        <button
          type="button"
          className="dex-switch-button"
          onClick={handleSwitch}
          title="Switch chain"
        >
          {chain === 'eth' ? 'Switch to BTC' : 'Switch to ETH'}
        </button>

        <button
          type="button"
          className="dex-connect-button"
          onClick={handleConnect}
          aria-pressed={connected ? 'true' : 'false'}
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
      </div>
    </header>
  );
}
