import './Header.css';

export default function Header({ connected, setConnected, activeTab, setActiveTab }) {
  const tabs = ['Swap', 'Intents', 'Liquidity', 'Staking', 'Whitepaper', 'Roadmap'];

  return (
    <header className="dex-header">
      <div className="logo">IntentSwap</div>
      <nav className="dex-nav">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`dex-nav-link  ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </nav>
      <button className="connect-button">
        {connected ? 'Connected' : 'Connect'}
      </button>
    </header>
  );
}
