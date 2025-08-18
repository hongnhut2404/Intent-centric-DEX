import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import IntentList from './components/IntentList/IntentList';
import MatchedList from './components/MatchedList/MatchedList';
import HtlcPanel from './components/HtlcPanel/HtlcPanel';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import RoleSelectModal from './components/RoleSelect/RoleSelectModal';
import { useLocalSigners } from './web3/LocalSignerContext';
import './App.css';

export default function AppEth() {
  const nav = useNavigate();
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('Swap');
  const [ethRole, setEthRole] = useState(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const { userAddress, mmAddress } = useLocalSigners();
  const short = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : '—');

  const handleConnectClick = () => setShowRolePicker(true);

  return (
    <div className="dex-app">
      <Header
        chain="eth"
        onSwitch={() => nav('/btc')}
        connected={connected}
        setConnected={setConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onConnectClick={handleConnectClick}
      />

      <main className="dex-main">
        {activeTab === 'Swap' && <SwapCard role={ethRole === 'MM' ? 'mm' : 'user'} />}
        {activeTab === 'Intents' && <IntentList />}
        {activeTab === 'Matches' && <MatchedList />}
        {activeTab === 'HTLC' && <HtlcPanel />}
      </main>

      <Footer />
      <ChatIcon />

      {showRolePicker && (
        <RoleSelectModal
          userAddress={userAddress}
          mmAddress={mmAddress}
          onClose={() => setShowRolePicker(false)}
          onPick={(picked) => { setEthRole(picked); setConnected(true); setShowRolePicker(false); }}
        />
      )}
    </div>
  );
}
