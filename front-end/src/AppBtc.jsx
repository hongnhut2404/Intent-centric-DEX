// AppBtc.jsx (or wherever your BTC page root is)
import { useState } from "react";
import BitcoinConnectModal from "./components/BitcoinConnect/BitcoinConnectModal";
import BitcoinPanel from "./components/BitcoinPanel/BitcoinPanel";

export default function AppBtc() {
  const [showConnect, setShowConnect] = useState(false);
  const [btcActor, setBtcActor] = useState(null); 
  // shape: { who: 'alice'|'bob', roleLabel: 'Solver'|'User', address: '...' }

  return (
    <>
      <header className="dex-header">
        <div className="dex-logo">IntentSwap — Bitcoin</div>
        <button className="dex-connect-button" onClick={() => setShowConnect(true)}>
          {btcActor ? `${btcActor.roleLabel}` : "Connect"}
        </button>
      </header>

      <main className="dex-main">
        {btcActor ? (
          <BitcoinPanel btcIdentity={btcActor} />
        ) : (
          <div style={{ color:'#e5e7eb', padding:'2rem' }}>
            Click <strong>Connect</strong> to choose Alice (Solver) or Bob (User).
          </div>
        )}
      </main>

      {showConnect && (
        <BitcoinConnectModal
          onClose={() => setShowConnect(false)}
          onPick={(actor) => { setBtcActor(actor); setShowConnect(false); }}
        />
      )}
    </>
  );
}
