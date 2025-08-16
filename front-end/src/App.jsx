// App.jsx
import { useState } from 'react';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import IntentList from './components/IntentList/IntentList';
import MarketMakerPanel from './components/MarketMaker/MarketMakerPanel';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import { useLocalSigners } from './web3/LocalSignerContext';
import RoleSelectModal from './components/RoleSelect/RoleSelectModal';   // ⬅️ new
import './App.css';

export default function App() {
  // treat "connected" as a UI state since we’re using local signers
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('Swap'); // matches navbar
  const [showRolePicker, setShowRolePicker] = useState(false);

  const { userAddress, mmAddress } = useLocalSigners();
  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

  const handleConnectClick = () => setShowRolePicker(true);

  const handlePickRole = (role) => {
    // role is 'User' or 'MM'
    setConnected(true);
    setShowRolePicker(false);
    if (role === 'User') setActiveTab('Swap');
    if (role === 'MM') setActiveTab('Market Maker');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Swap':       
      case 'User':
        return <SwapCard />;

      case 'Intents':    
        return <IntentList />;

      case 'Market Maker':
      case 'MM':
        return <MarketMakerPanel />;

      default:
        return <div style={{ color: 'white', padding: '2rem' }}>Coming Soon...</div>;
    }
  };


  return (
    <div className="dex-app">
      <Header
        connected={connected}
        setConnected={setConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onConnectClick={handleConnectClick}   // <-- this opens the User/MM modal
      />


      {/* Fixed local addresses banner */}
      <div style={{
        background: '#111826',
        color: '#e5e7eb',
        padding: '8px 12px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        borderBottom: '1px solid #1f2937'
      }}>
        <span><strong>User:</strong> {short(userAddress)}</span>
        <span><strong>MM:</strong> {short(mmAddress)}</span>
        <span style={{ opacity: 0.8 }}>Local RPC: 127.0.0.1:8545</span>
      </div>

      <main className="dex-main">
        {renderTabContent()}
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
