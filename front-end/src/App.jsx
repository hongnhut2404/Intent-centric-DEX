// App.jsx
import { useState } from 'react';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import IntentList from './components/IntentList/IntentList';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import { useLocalSigners } from './web3/LocalSignerContext';
import RoleSelectModal from './components/RoleSelect/RoleSelectModal';
import './App.css';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('Swap');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [role, setRole] = useState(null); // 'User' | 'MM'

  const { userAddress, mmAddress } = useLocalSigners();
  const short = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : '—');

  const handleConnectClick = () => setShowRolePicker(true);
  const handlePickRole = (picked) => {
    setRole(picked);          // 'User' or 'MM'
    setConnected(true);
    setShowRolePicker(false);
    setActiveTab('Swap');     // stay on Swap; card will switch by role
  };

  return (
    <div className="dex-app">
      <Header
        connected={connected}
        setConnected={setConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onConnectClick={handleConnectClick}
      />

      {/* Status banner */}
      <div style={{
        background: '#111826', color: '#e5e7eb', padding: '8px 12px',
        display: 'flex', gap: '16px', alignItems: 'center',
        borderBottom: '1px solid #1f2937'
      }}>
        <span><strong>Role:</strong> {role ?? '—'}</span>
        <span><strong>User:</strong> {short(userAddress)}</span>
        <span><strong>MM:</strong> {short(mmAddress)}</span>
        <span style={{ opacity: 0.8 }}>Local RPC: 127.0.0.1:8545</span>
      </div>

      <main className="dex-main">
        {!connected ? (
          <div style={{ color: 'white', padding: '2rem' }}>
            <p style={{ marginBottom: 12 }}>Click <strong>Connect</strong> to choose a role.</p>
            <button onClick={handleConnectClick} className="dex-swap-button">Connect</button>
          </div>
        ) : activeTab === 'Swap' ? (
          <SwapCard role={role === 'MM' ? 'mm' : 'user'} />
        ) : (
          <IntentList />
        )}
      </main>

      <Footer />
      <ChatIcon />

      {showRolePicker && (
        <RoleSelectModal
          userAddress={userAddress}
          mmAddress={mmAddress}
          onClose={() => setShowRolePicker(false)}
          onPick={handlePickRole}
        />
      )}
    </div>
  );
}
