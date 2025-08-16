// src/web3/LocalSignerContext.jsx
import { createContext, useContext, useMemo } from 'react';
import { provider, userWallet, mmWallet } from './local';

const LocalSignerCtx = createContext(null);

export function LocalSignerProvider({ children }) {
  const value = useMemo(() => ({
    provider,
    userSigner: userWallet,
    mmSigner: mmWallet,
    userAddress: userWallet.address,
    mmAddress: mmWallet.address,
  }), []);
  return <LocalSignerCtx.Provider value={value}>{children}</LocalSignerCtx.Provider>;
}

export function useLocalSigners() {
  const ctx = useContext(LocalSignerCtx);
  if (!ctx) throw new Error('useLocalSigners must be used inside LocalSignerProvider');
  return ctx;
}
