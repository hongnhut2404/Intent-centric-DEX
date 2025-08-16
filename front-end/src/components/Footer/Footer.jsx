import './Footer.css';

export default function Footer() {
  return (
    <footer className="dex-footer">
      <div className="dex-price-info">
        <span>ETH $988.8</span>
        <span>BTC $975216</span>
      </div>
      <div className="dex-copyright">
        © 2023 IntentSwap. All rights reserved.
      </div>
    </footer>
  );
}