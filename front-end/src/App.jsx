import { useState } from 'react';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import IntentList from './components/IntentList/IntentList';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import './App.css';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('Swap'); // default tab

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Swap':
        return <SwapCard />;
      case 'Intents':
        return <IntentList />;
      default:
        return <div style={{ color: "white", padding: "2rem" }}>Coming Soon...</div>;
    }
  };

  return (
    <div className="dex-app">
      <Header
        connected={connected}
        setConnected={setConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <main className="dex-main">
        {renderTabContent()}
      </main>
      <Footer />
      <ChatIcon />
    </div>
  );
}
