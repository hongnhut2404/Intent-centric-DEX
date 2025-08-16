import { useState } from 'react';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import IntentList from './components/IntentList/IntentList';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import RoleSelectModal from './components/RoleSelect/RoleSelectModal'; // ETH modal
import BitcoinConnectModal from './components/BitcoinConnect/BitcoinConnectModal'; // BTC modal
import BitcoinPanel from './components/BitcoinPanel/BitcoinPanel';
import { useLocalSigners } from './web3/LocalSignerContext';
import './App.css';

export default function App() {
  const [connected, setConnected] = useState(false);

  // 'eth' | 'btc'
  const [chain, setChain] = useState('eth');

  // ETH-only
  const [activeTab, setActiveTab] = useState('Swap'); // 'Swap' | 'Intents' | ...
  const [ethRole, setEthRole] = useState(null);       // 'User' | 'MM'
  const [showRolePicker, setShowRolePicker] = useState(false);

  // BTC-only
  const [btcIdentity, setBtcIdentity] = useState(null); // { who: 'alice'|'bob', address }
  const [showBtcPicker, setShowBtcPicker] = useState(false);

  const { userAddress, mmAddress } = useLocalSigners();
  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

  // Connect flow
  const handleConnectClick = () => {
    if (chain === 'eth') setShowRolePicker(true);
    else setShowBtcPicker(true);
  };

  const handlePickEthRole = (picked) => {
    setEthRole(picked);
    setConnected(true);
    setShowRolePicker(false);
    setActiveTab('Swap');
  };

  const handlePickBtc = (payload) => {
    setBtcIdentity({ who: payload.who, address: payload.address });
    setConnected(true);
    setShowBtcPicker(false);
  };

  const renderMain = () => {
    if (chain === 'eth') {
      if (activeTab === 'Swap') return <SwapCard role={ethRole === 'MM' ? 'mm' : 'user'} />;
      if (activeTab === 'Intents') return <IntentList />;
      return <div style={{ color: 'white', padding: '2rem' }}>Coming Soon…</div>;
    }
    // Bitcoin page
    return <BitcoinPanel btcIdentity={btcIdentity} />;
  };

  return (
    <div className="dex-app">
      <Header
        connected={connected}
        setConnected={setConnected}
        activeTab={chain === 'eth' ? activeTab : undefined}
        setActiveTab={chain === 'eth' ? setActiveTab : () => {}}
        onConnectClick={handleConnectClick}
        chain={chain}
        setChain={setChain}
      />

      {/* Status bar below header */}
      <div
        style={{
          background: '#111826',
          color: '#e5e7eb',
          padding: '8px 12px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          borderBottom: '1px solid #1f2937',
        }}
      >
        {chain === 'eth' ? (
          <>
            <span><strong>Role:</strong> {ethRole ?? '—'}</span>
            <span><strong>User:</strong> {short(userAddress)}</span>
            <span><strong>MM:</strong> {short(mmAddress)}</span>
          </>
        ) : (
          <>
            <span><strong>BTC Who:</strong> {btcIdentity?.who ?? '—'}</span>
            <span><strong>BTC Addr:</strong> {btcIdentity ? short(btcIdentity.address) : '—'}</span>
          </>
        )}
        <span style={{ opacity: 0.8 }}>Local RPC: 127.0.0.1:8545</span>
      </div>

      <main className="dex-main">{renderMain()}</main>
      <Footer />
      <ChatIcon />

      {showRolePicker && chain === 'eth' && (
        <RoleSelectModal
          userAddress={userAddress}
          mmAddress={mmAddress}
          onClose={() => setShowRolePicker(false)}
          onPick={handlePickEthRole}
        />
      )}

      {showBtcPicker && chain === 'btc' && (
        <BitcoinConnectModal
          onClose={() => setShowBtcPicker(false)}
          onPick={handlePickBtc}
        />
      )}
    </div>
  );
}
