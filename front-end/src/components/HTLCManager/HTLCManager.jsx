import React, { useState, useEffect } from 'react';
import HTLCService from '../../service/htlcService';
import './HTLCManager.css';

const HTLCManager = () => {
  const [htlcService] = useState(new HTLCService());
  const [htlcs, setHtlcs] = useState([]);
  const [htlcStatus, setHtlcStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('view');
  
  // Form states
  const [fundAmount, setFundAmount] = useState('100.0');
  const [buyIntentId, setBuyIntentId] = useState('0');
  const [withdrawSecret, setWithdrawSecret] = useState('');
  const [withdrawLockId, setWithdrawLockId] = useState('');
  const [selectedHTLC, setSelectedHTLC] = useState(null);

  useEffect(() => {
    loadHTLCStatus();
    loadHTLCs();
  }, []);

  const loadHTLCStatus = async () => {
    setLoading(true);
    try {
      const result = await htlcService.getHTLCStatus();
      if (result.success) {
        setHtlcStatus(result);
      } else {
        setMessage(`Error loading status: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const loadHTLCs = async () => {
    try {
      const result = await htlcService.viewAllHTLCs();
      if (result.success) {
        setHtlcs(result.htlcs);
        if (result.message && result.count === 0) {
          setMessage(result.message);
        }
      } else {
        setMessage(`Error loading HTLCs: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDeployHTLC = async () => {
    setLoading(true);
    setMessage('Deploying HTLC contract...');
    
    try {
      const result = await htlcService.deployHTLC();
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        await loadHTLCStatus();
      } else {
        setMessage(`❌ Deploy failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleFundHTLC = async () => {
    setLoading(true);
    setMessage('Funding multisig wallet...');
    
    try {
      const result = await htlcService.fundHTLC(fundAmount);
      if (result.success) {
        setMessage(`✅ ${result.message}. New balance: ${result.newBalance} ETH`);
        await loadHTLCStatus();
      } else {
        setMessage(`❌ Funding failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCreateHTLC = async () => {
    setLoading(true);
    setMessage('Creating HTLCs for matched trades...');
    
    try {
      const result = await htlcService.createHTLC(parseInt(buyIntentId));
      if (result.success) {
        setMessage(`✅ ${result.message}${result.secret ? `\n🔑 Secret: ${result.secret}` : ''}`);
        await loadHTLCs();
      } else {
        setMessage(`❌ Creation failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleViewHTLCs = async () => {
    setLoading(true);
    setMessage('Loading HTLCs...');
    await loadHTLCs();
    setMessage('HTLCs refreshed');
    setLoading(false);
  };

  const handleWithdrawHTLC = async () => {
    if (!withdrawLockId || !withdrawSecret) {
      setMessage('Please provide both Lock ID and Secret');
      return;
    }
    
    setLoading(true);
    setMessage('Withdrawing from HTLC...');
    
    try {
      const result = await htlcService.withdrawHTLC(withdrawLockId, withdrawSecret);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        await loadHTLCs();
        setWithdrawLockId('');
        setWithdrawSecret('');
      } else {
        setMessage(`❌ Withdrawal failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleRefundHTLC = async (lockId) => {
    setLoading(true);
    setMessage('Processing refund...');
    
    try {
      const result = await htlcService.refundHTLC(lockId);
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        await loadHTLCs();
      } else {
        setMessage(`❌ Refund failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const StatusCard = () => (
    <div className="htlc-status-card">
      <h3>HTLC System Status</h3>
      {htlcStatus ? (
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">HTLC Deployed:</span>
            <span className={`status-value ${htlcStatus.htlcDeployed ? 'success' : 'error'}`}>
              {htlcStatus.htlcDeployed ? '✅' : '❌'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">HTLC Address:</span>
            <span className="status-value">{htlcStatus.htlcAddress || 'Not deployed'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Multisig Balance:</span>
            <span className="status-value">{htlcStatus.multisigBalance} ETH</span>
          </div>
          <div className="status-item">
            <span className="status-label">System Ready:</span>
            <span className={`status-value ${htlcStatus.isReady ? 'success' : 'warning'}`}>
              {htlcStatus.isReady ? '✅ Ready' : '⚠️ Setup Required'}
            </span>
          </div>
        </div>
      ) : (
        <div className="status-loading">Loading status...</div>
      )}
    </div>
  );

  const HTLCList = () => (
    <div className="htlc-list">
      <div className="htlc-list-header">
        <h3>Active HTLCs ({htlcs.length})</h3>
        <button 
          className="btn btn-secondary" 
          onClick={handleViewHTLCs}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>
      
      {htlcs.length === 0 ? (
        <div className="empty-state">
          <p>No HTLCs found. Create some HTLCs from matched trades first.</p>
        </div>
      ) : (
        <div className="htlc-grid">
          {htlcs.map((htlc, index) => (
            <div key={index} className={`htlc-card ${htlc.isExpired ? 'expired' : ''}`}>
              <div className="htlc-header">
                <h4>HTLC #{htlc.id}</h4>
                <span className={`htlc-status ${htlc.isExpired ? 'expired' : 'active'}`}>
                  {htlc.isExpired ? '⏰ Expired' : '🔒 Active'}
                </span>
              </div>
              
              <div className="htlc-details">
                <div className="detail-row">
                  <span className="label">Recipient:</span>
                  <span className="value">{htlc.recipient.slice(0, 6)}...{htlc.recipient.slice(-4)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="value">{htlc.amount} ETH</span>
                </div>
                <div className="detail-row">
                  <span className="label">Timelock:</span>
                  <span className="value">{htlc.timelock}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Secret Hash:</span>
                  <span className="value hash">{htlc.secretHash.slice(0, 10)}...</span>
                </div>
              </div>
              
              <div className="htlc-actions">
                {htlc.isExpired ? (
                  <button 
                    className="btn btn-warning"
                    onClick={() => handleRefundHTLC(htlc.id)}
                    disabled={loading}
                  >
                    💰 Refund
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedHTLC(htlc);
                      setWithdrawLockId(htlc.id.toString());
                      setActiveTab('withdraw');
                    }}
                    disabled={loading}
                  >
                    🔓 Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="htlc-manager">
      <div className="htlc-header">
        <h2>HTLC Management</h2>
        <p>Manage Hash Time Lock Contracts for atomic swaps</p>
      </div>

      <StatusCard />

      <div className="htlc-tabs">
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            📋 View HTLCs
          </button>
          <button 
            className={`tab-btn ${activeTab === 'deploy' ? 'active' : ''}`}
            onClick={() => setActiveTab('deploy')}
          >
            🚀 Deploy
          </button>
          <button 
            className={`tab-btn ${activeTab === 'fund' ? 'active' : ''}`}
            onClick={() => setActiveTab('fund')}
          >
            💰 Fund
          </button>
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ➕ Create
          </button>
          <button 
            className={`tab-btn ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            🔓 Withdraw
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'view' && <HTLCList />}

          {activeTab === 'deploy' && (
            <div className="tab-panel">
              <h3>Deploy HTLC Contract</h3>
              <p>Deploy the HTLC contract to enable atomic swaps. This is typically done once during system setup.</p>
              
              <div className="action-group">
                <button 
                  className="btn btn-primary btn-large"
                  onClick={handleDeployHTLC}
                  disabled={loading || (htlcStatus && htlcStatus.htlcDeployed)}
                >
                  {loading ? '⏳ Deploying...' : '🚀 Deploy HTLC Contract'}
                </button>
                
                {htlcStatus && htlcStatus.htlcDeployed && (
                  <div className="info-message success">
                    ✅ HTLC contract is already deployed at: {htlcStatus.htlcAddress}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'fund' && (
            <div className="tab-panel">
              <h3>Fund Multisig Wallet</h3>
              <p>Fund the multisig wallet to enable HTLC operations.</p>
              
              <div className="form-group">
                <label>Amount (ETH):</label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="100.0"
                  step="0.1"
                />
              </div>
              
              <button 
                className="btn btn-primary"
                onClick={handleFundHTLC}
                disabled={loading}
              >
                {loading ? '⏳ Funding...' : '💰 Fund Multisig'}
              </button>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="tab-panel">
              <h3>Create HTLCs</h3>
              <p>Create HTLCs for matched trades. This locks ETH with a secret hash.</p>
              
              <div className="form-group">
                <label>Buy Intent ID:</label>
                <input
                  type="number"
                  value={buyIntentId}
                  onChange={(e) => setBuyIntentId(e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <button 
                className="btn btn-primary"
                onClick={handleCreateHTLC}
                disabled={loading}
              >
                {loading ? '⏳ Creating...' : '➕ Create HTLCs'}
              </button>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="tab-panel">
              <h3>Withdraw from HTLC</h3>
              <p>Withdraw funds by revealing the secret. This completes the atomic swap.</p>
              
              <div className="form-group">
                <label>Lock ID:</label>
                <input
                  type="text"
                  value={withdrawLockId}
                  onChange={(e) => setWithdrawLockId(e.target.value)}
                  placeholder="Lock ID"
                />
              </div>
              
              <div className="form-group">
                <label>Secret:</label>
                <input
                  type="text"
                  value={withdrawSecret}
                  onChange={(e) => setWithdrawSecret(e.target.value)}
                  placeholder="Enter the secret to unlock funds"
                />
              </div>
              
              <button 
                className="btn btn-success"
                onClick={handleWithdrawHTLC}
                disabled={loading || !withdrawLockId || !withdrawSecret}
              >
                {loading ? '⏳ Withdrawing...' : '🔓 Withdraw'}
              </button>
              
              {selectedHTLC && (
                <div className="info-message">
                  <strong>Selected HTLC:</strong><br />
                  Amount: {selectedHTLC.amount} ETH<br />
                  Recipient: {selectedHTLC.recipient}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('❌') ? 'error' : message.includes('✅') ? 'success' : 'info'}`}>
          <pre>{message}</pre>
        </div>
      )}
    </div>
  );
};

export default HTLCManager;
