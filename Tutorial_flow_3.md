Here’s how you can implement and link these atomic swap steps in your system, with clear separation between User and Solver roles, and integration with your backend and frontend:

1. User/Solver Switching
Backend:
When you run go run main.go init alice and go run main.go init bob, store their addresses (e.g., in a database or config file).
Frontend:
Provide a UI toggle (dropdown or buttons) to switch between User (Alice) and Solver (Bob).
When a role is selected, use the corresponding address for subsequent actions.
Example React UI:
const [role, setRole] = useState('user'); // 'user' or 'solver'
const [address, setAddress] = useState('');

useEffect(() => {
  // Fetch address from backend based on role
  fetch(`/api/btc/address?role=${role}`)
    .then(res => res.json())
    .then(data => setAddress(data.address));
}, [role]);

return (
  <div>
    <select value={role} onChange={e => setRole(e.target.value)}>
      <option value="user">User (Alice)</option>
      <option value="solver">Solver (Bob)</option>
    </select>
    <div>Current Address: {address}</div>
    {/* Workflow buttons go here */}
  </div>
);

2. Create HTLC (User)
Backend:
Endpoint to generate payment message and secretHash.
Endpoint to verify OP_RETURN and signature.
Endpoint to create HTLC contract using extracted info.
Example Backend Endpoints:
app.post('/api/btc/generate-message', (req, res) => {
  runCommand('cd bitcoin-chain/src/payment-channel && go run main.go generate-message', res);
});

app.post('/api/btc/verify-opreturn', (req, res) => {
  runCommand('cd bitcoin-chain/src/payment-channel && go run main.go verify-opreturn ../../data-script/payment_message.json ../../data-script/payment_opreturn.txt', res);
});

app.post('/api/btc/create-htlc', (req, res) => {
  runCommand('cd bitcoin-chain/src/htlc/create-htlc && go run *.go', res);
});
Frontend:
User triggers these steps in order.
Display secretHash and status after each step.


3. Fund HTLC (User)
Backend:
Endpoint to fund HTLC and wait for mining.
Example:
app.post('/api/btc/fund-htlc', (req, res) => {
  runCommand('cd bitcoin-chain/src/htlc/fund && go run *.go', res);
  // Optionally, add a sleep or mining status check
});

Frontend:
User clicks "Fund HTLC" button.
Show mining status/progress.

4. Redeem (Solver)
Backend:
Endpoint to scan HTLC address, create redeem transaction, and sign it.
Example:
app.post('/api/btc/scan-htlc', (req, res) => {
  runCommand('cd bitcoin-chain/src/htlc/scan-htlc && go run *.go', res);
});
app.post('/api/btc/create-redeem', (req, res) => {
  runCommand('cd bitcoin-chain/src/htlc/create-redeem && go run *.go', res);
});
app.post('/api/btc/sign-redeem', (req, res) => {
  runCommand('cd bitcoin-chain/src/htlc/sign-redeem && go run *.go', res);
});


Frontend:
Solver switches role, then triggers redeem steps.
Show transaction status and signed transaction.
5. Bitcoin RPC Integration
Use the provided RPC credentials in your backend Go scripts or Node.js services to interact with the Bitcoin node for UTXO scanning, transaction broadcasting, etc.
Example Go config:

const (
    rpcUser     = "admin"
    rpcPassword = "HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso"
    rpcURL      = "http://127.0.0.1:8332"
)

6. Atomicity & Data Flow
Secret hash: Pass the same secretHash between BTC and ETH flows.
Status: Store and display HTLC status, redemption, and refund for both chains.
Security: Only reveal the secret after both HTLCs are funded.
7. Example Unified Frontend Flow

// Pseudocode for workflow panel
if (role === 'user') {
  // Show buttons for: generate message, verify OP_RETURN, create HTLC, fund HTLC
} else if (role === 'solver') {
  // Show buttons for: scan HTLC, create redeem, sign redeem
}

Summary:

Switch roles in the UI and backend.
Trigger each atomic swap step via backend endpoints.
Pass secretHash and status between BTC and ETH flows.
Use Bitcoin RPC for blockchain interactions.
Ensure atomicity by coordinating actions and secret revelation.
If you want full code for a specific step or a more detailed UI, let me know!