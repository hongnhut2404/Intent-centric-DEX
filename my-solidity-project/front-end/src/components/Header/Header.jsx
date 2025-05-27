import './Header.css';
import logo from '../../assets/logo.png'; 

export default function Header({ connected, setConnected }) {
  return (
    <header className="dex-header">
      <div className="dex-logo">
        <img src={logo} alt="IntentSwap Logo" className="dex-logo-img" />
        IntentSwap
      </div>
      
      <nav className="dex-nav">
        <a href="#" className="dex-nav-link active">Swap</a>
        <a href="#" className="dex-nav-link">Liquidity</a>
        <a href="#" className="dex-nav-link">Staking</a>
        <a href="#" className="dex-nav-link">Whitepaper</a>
        <a href="#" className="dex-nav-link">Roadmap</a>
      </nav>
      
      <div className="dex-header-actions">
        <button 
          className="dex-connect-button"
          onClick={() => setConnected(!connected)}
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
        
        <button className="dex-menu-button">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}