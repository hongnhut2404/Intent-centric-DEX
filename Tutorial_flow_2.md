To link your BTC and ETH flows for an atomic swap, you need to coordinate actions and data between the two chains. Here’s how you can achieve this in your backend and frontend:

1. Backend Coordination
Share secrets and status:
When you generate a secret or payment message on one chain (e.g., BTC), store it in a database or pass it to the ETH flow.
Trigger ETH actions from BTC events:
After BTC HTLC is funded and the secret is generated, call ETH endpoints to create/fund the ETH HTLC with the same secret hash.
Monitor both chains:
Use backend logic to watch for redeem/refund events on both chains and update the frontend.
Example Backend Flow:

// After BTC HTLC is funded and secret is generated
app.post('/api/swap/step', async (req, res) => {
  // 1. Run BTC step
  await runCommand('cd bitcoin-chain/src/payment-channel && go run main.go generate-message', res);
  // 2. Extract secret/hash from BTC output
  const secretHash = extractHashFromOutput(...);
  // 3. Call ETH endpoint to create HTLC with same hash
  await runCommand(`npx hardhat run localhost-script/htlc/createHTLC.js --network localhost --secretHash ${secretHash}`, res);
  // 4. Respond with status
  res.json({ message: 'BTC and ETH HTLCs created and linked.' });
});

2. Frontend Coordination
Unified Swap Panel:
Create a React component that guides the user through both BTC and ETH steps, showing status and results for each.
Display cross-chain status:
Show when BTC HTLC is funded, when ETH HTLC is created, and when secrets are revealed/redeemed.
Trigger next chain’s step automatically or manually:
After BTC step completes, enable ETH step button or trigger it automatically.
Example React Flow:

const [btcStatus, setBtcStatus] = useState('');
const [ethStatus, setEthStatus] = useState('');
const [secretHash, setSecretHash] = useState('');

const runBtcStep = async () => {
  const res = await fetch('/api/btc/generate-message', { method: 'POST' });
  const data = await res.json();
  setBtcStatus(data.message);
  // Extract secretHash from data.message
  setSecretHash(extractHash(data.message));
};

const runEthStep = async () => {
  const res = await fetch(`/api/eth/create-htlc?secretHash=${secretHash}`, { method: 'POST' });
  const data = await res.json();
  setEthStatus(data.message);
};

return (
  <div>
    <button onClick={runBtcStep}>BTC: Generate Payment Message</button>
    <div>{btcStatus}</div>
    <button onClick={runEthStep} disabled={!secretHash}>ETH: Create HTLC</button>
    <div>{ethStatus}</div>
  </div>
);

3. Atomicity & Security
Atomicity:
Only reveal the secret on one chain after the other chain’s HTLC is funded.
Refund logic:
If one side fails, allow users to trigger refund on both chains.
4. Data Flow
Secret hash is the bridge:
Use the same secret hash for both BTC and ETH HTLC contracts.
Status updates:
Store and display the status of each chain’s HTLC, redemption, and refund.
Summary:
Link the flows by passing the secret hash and status between backend endpoints and frontend UI. Coordinate actions so that each chain’s step is triggered at the right time, ensuring atomicity and user clarity.

