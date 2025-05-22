import { useState } from 'react';
import Header from './components/Header/Header';
import SwapCard from './components/SwapCard/SwapCard';
import Footer from './components/Footer/Footer';
import ChatIcon from './components/ChatIcon/ChatIcon';
import './App.css';

export default function App() {
  const [connected, setConnected] = useState(false);

  return (
    <div className="dex-app">
      <Header connected={connected} setConnected={setConnected} />
      <main className="dex-main">
        <SwapCard />
      </main>
      <Footer />
      <ChatIcon />
    </div>
  );
}