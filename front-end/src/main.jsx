import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LocalSignerProvider } from './web3/LocalSignerContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocalSignerProvider>
      <App />
    </LocalSignerProvider>
  </React.StrictMode>
);
