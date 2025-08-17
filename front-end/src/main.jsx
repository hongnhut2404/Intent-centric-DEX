// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppEth from "./AppEth.jsx";
import AppBtc from "./AppBtc.jsx";
import { LocalSignerProvider } from "./web3/LocalSignerContext.jsx"; // 👈 import provider
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route
        path="/eth"
        element={
          <LocalSignerProvider>
            <AppEth />
          </LocalSignerProvider>
        }
      />
      <Route path="/btc" element={<AppBtc />} />
      <Route path="/" element={<Navigate to="/eth" replace />} />
    </Routes>
  </BrowserRouter>
);
