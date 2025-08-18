// server.js (ESM)
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// -------------------- middleware --------------------
app.use(compression());
app.use(cors());
app.use(express.json());

// -------------------- static (vite build) --------------------
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

/* =========================================
 * ETH / Hardhat integration (unchanged)
 * ========================================= */
const HARDHAT_CWD = path.join(__dirname, '../my-solidity-project');
const GO_BIN = process.env.GO_BIN || '/usr/local/go/bin/go';


function runNode(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe', cwd: HARDHAT_CWD, ...opts });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));
    child.on('close', code => {
      if (code === 0) resolve({ code, out, err });
      else reject(Object.assign(new Error(`Process exited ${code}`), { code, out, err }));
    });
  });
}

app.post('/api/htlc/fund', async (_req, res) => {
  try {
    const { out, err } = await runNode('npx', ['hardhat', 'run', 'localhost-script/htlc/fund.js', '--network', 'localhost']);
    res.json({ ok: true, out, err });
  } catch (e) { res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err }); }
});

app.post('/api/htlc/create', async (req, res) => {
  try {
    const env = { ...process.env };
    if (req.body?.buyId != null) env.BUY_ID = String(req.body.buyId);
    const { out, err } = await runNode('npx', ['hardhat', 'run', 'localhost-script/htlc/createHTLC.js', '--network', 'localhost'], { env });
    res.json({ ok: true, out, err });
  } catch (e) { res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err }); }
});

app.get('/api/htlc/view', async (_req, res) => {
  try {
    const { out, err } = await runNode('npx', ['hardhat', 'run', 'localhost-script/htlc/viewHTLC.js', '--network', 'localhost']);
    res.json({ ok: true, out, err });
  } catch (e) { res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err }); }
});

// server.js excerpt
// server.js
app.post('/api/htlc/withdraw', async (req, res) => {
  try {
    const { buyId, secret } = req.body ?? {};
    const env = { ...process.env };
    if (buyId !== undefined && buyId !== null) env.BUY_ID = String(buyId);
    if (secret) env.SECRET = String(secret);

    const { out, err } = await runNode(
      'npx',
      // USE THE CORRECT PATH YOU ARE USING LOCALLY:
      ['hardhat', 'run', 'localhost-script/htlc/withdrawHTLC.js', '--network', 'localhost'],
      { env }
    );

    res.json({ ok: true, out, err });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err });
  }
});



/* =========================================
 * BTC integration (Go + bitcoind RPC)
 * ========================================= */
const BTC_ROOT = path.join(__dirname, '../bitcoin-chain');
const BTC_STATE = path.join(BTC_ROOT, 'data-script', 'state.json');
const BTC_RPC_URL = 'http://127.0.0.1:8332';
const BTC_RPC_USER = 'admin';
const BTC_RPC_PASS = 'HouiWGc9wyj_2Fx2G9FYnQAr3AIXEeb-uRNRNITgKso';

function runGo(subdir, args = ['run', 'main.go'], opts = {}) {
  const cwd = path.join(BTC_ROOT, subdir);
  if (!fs.existsSync(cwd)) {
    throw new Error(`[runGo] cwd does not exist: ${cwd}`);
  }

  // Log once to see exactly where we’re spawning
  console.log(`[runGo] ${GO_BIN} ${args.join(' ')}  (cwd=${cwd})`);

  return new Promise((resolve, reject) => {
    const child = spawn(GO_BIN, args, {
      stdio: 'pipe',
      cwd,
      ...opts,
    });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));
    child.on('error', (e) => {
      // This is where ENOENT shows up if go isn’t found or cwd is bad
      reject(Object.assign(new Error(`[runGo] spawn error: ${e.message}`), { out, err }));
    });
    child.on('close', code => {
      if (code === 0) resolve({ code, out, err });
      else reject(Object.assign(new Error(`[runGo] Process exited ${code}`), { code, out, err }));
    });
  });
}
// Helper: JSON-RPC to bitcoind
async function callBtcRpc(method, params = []) {
  const r = await fetch(BTC_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${BTC_RPC_USER}:${BTC_RPC_PASS}`).toString('base64'),
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'ui', method, params }),
  });
  const json = await r.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

// 0) Identities (read file written by Go keygen)
app.get('/api/btc/state', (_req, res) => {
  try {
    if (!fs.existsSync(BTC_STATE)) return res.json({ ok: true, alice: null, bob: null });
    const data = JSON.parse(fs.readFileSync(BTC_STATE, 'utf8'));
    return res.json({ ok: true, alice: data.alice ?? null, bob: data.bob ?? null });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// 0b) Optional: init alice/bob via API (go run main.go init <who>)
app.post('/api/btc/init', async (req, res) => {
  try {
    const { who } = req.body || {};
    if (!['alice', 'bob'].includes(who)) return res.status(400).json({ ok: false, error: "who must be 'alice' or 'bob'" });
    const r = await runGo('src/payment-channel', ['run', 'main.go', 'init', who]);
    let state = {};
    if (fs.existsSync(BTC_STATE)) state = JSON.parse(fs.readFileSync(BTC_STATE, 'utf8'));
    res.json({ ok: true, out: r.out, err: r.err, state });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// 1) Balance (scantxoutset)
app.post('/api/btc/balance', async (req, res) => {
  try {
    const { address } = req.body || {};
    if (!address) return res.status(400).json({ ok: false, error: 'address is required' });
    const result = await callBtcRpc('scantxoutset', ['start', [`addr(${address})`]]);
    res.json({ ok: true, total: result.total_amount, utxos: result.unspents || [] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// 2) Solver (Alice): generate payment message + OP_RETURN
app.post('/api/btc/generate', async (req, res) => {
  try {
    const env = { ...process.env };
    if (req.body?.secret) env.BTC_PM_SECRET = String(req.body.secret);
    if (req.body?.amount) env.BTC_PM_AMOUNT = String(req.body.amount);

    const r = await runGo('src/payment-channel', ['run', 'main.go', 'generate-message'], { env });

    // include artifacts if present
    const msgPath = path.join(BTC_ROOT, 'data-script', 'payment_message.json');
    const opretPath = path.join(BTC_ROOT, 'data-script', 'payment_opreturn.txt');
    const payload = {};
    if (fs.existsSync(msgPath)) payload.payment_message = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
    if (fs.existsSync(opretPath)) payload.op_return = fs.readFileSync(opretPath, 'utf8');

    res.type('text/plain').send(
      r.out + (r.err ? `\n[stderr]\n${r.err}` : '') +
      (Object.keys(payload).length ? `\n${JSON.stringify(payload, null, 2)}` : '')
    );
  } catch (e) { res.status(500).type('text/plain').send(e.out || e.err || e.message); }
});

// 3) User (Bob): verify OP_RETURN against saved message
app.post('/api/btc/verify-opreturn', async (_req, res) => {
  try {
    const r = await runGo('src/payment-channel', [
      'run', 'main.go', 'verify-opreturn',
      '../../data-script/payment_message.json',
      '../../data-script/payment_opreturn.txt',
    ]);
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : ''));
  } catch (e) { res.status(500).type('text/plain').send(e.out || e.err || e.message); }
});

// 4) User (Bob): create BTC HTLC
app.post('/api/btc/create-htlc', async (_req, res) => {
  try {
    const r = await runGo('src/htlc/create-htlc', ['run', '.']);
    const j = path.join(BTC_ROOT, 'data-script', 'htlc_contract.json');
    const extra = fs.existsSync(j) ? `\n${fs.readFileSync(j, 'utf8')}` : '';
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : '') + extra);
  } catch (e) { res.status(500).type('text/plain').send(e.out || e.err || e.message); }
});

// 5) User (Bob): fund HTLC
app.post('/api/btc/fund', async (_req, res) => {
  try {
    // run from the folder where main.go lives
    const r = await runGo('src/htlc/fund', ['run', '.']);
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : ''));
  } catch (e) {
    res.status(500).type('text/plain').send(e.out || e.err || e.message);
  }
});


// 6) Optional: scan HTLC
// Scan
app.post('/api/btc/scan', async (_req, res) => {
  try {
    const r = await runGo('src/htlc/scan-htlc', ['run', '.']);
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : ''));
  } catch (e) {
    res.status(500).type('text/plain').send(e.out || e.err || e.message);
  }
});

// Create redeem
app.post('/api/btc/create-redeem', async (_req, res) => {
  try {
    const r = await runGo('src/htlc/create-redeem', ['run', '.']);
    const j = path.join(BTC_ROOT, 'data-script', 'redeem_tx.json');
    const payload = fs.existsSync(j) ? `\n${fs.readFileSync(j,'utf8')}` : '';
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : '') + payload);
  } catch (e) {
    res.status(500).type('text/plain').send(e.out || e.err || e.message);
  }
});

// Sign redeem
app.post('/api/btc/sign-redeem', async (_req, res) => {
  try {
    const r = await runGo('src/htlc/sign-redeem', ['run', '.']);
    const outPath = path.join(BTC_ROOT, 'data-script', 'btc_reveal.json');
    const extra = fs.existsSync(outPath) ? `\n${fs.readFileSync(outPath, 'utf8')}` : '';
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : '') + extra);
  } catch (e) {
    res.status(500).type('text/plain').send(e.out || e.err || e.message);
  }
});

// --- reveal preimage from signed tx ---
// POST /api/btc/reveal-preimage
// Body (optional): { txid?: string, raw?: string }
// server.js
app.post('/api/btc/reveal-preimage', async (_req, res) => {
  try {
    // if your tool is in bitcoin-chain/src/htlc/sign-redeem-new
    const r = await runGo('src/htlc/reveal-preimage', ['run', '.']);
    // r.out should include lines like:
    // Secret (utf-8): ...
    // Secret (hex)  : ...
    // sha256(secret): ...
    // Saved: ../../../data-script/revealed_secret.json
    res.type('text/plain').send(r.out + (r.err ? `\n[stderr]\n${r.err}` : ''));
  } catch (e) {
    res.status(500).type('text/plain').send(e.out || e.err || e.message);
  }
});



// -------------------- 404 for /api/* --------------------
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

// -------------------- SPA catch-all --------------------
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// -------------------- start --------------------
const PORT = process.env.PORT || 5174;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
