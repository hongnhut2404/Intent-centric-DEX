// server.js (ESM)
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

// --- middleware ---
app.use(compression());
app.use(cors());
app.use(express.json());

// --- static files (vite build output) ---
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// --- helper to run hardhat scripts ---
const HARDHAT_CWD = path.join(__dirname, '../my-solidity-project');

function runNode(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'pipe',
      cwd: HARDHAT_CWD,            // 👈 IMPORTANT
      ...opts,
    });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));
    child.on('close', code => {
      if (code === 0) resolve({ code, out, err });
      else reject(Object.assign(new Error(`Process exited ${code}`), { code, out, err }));
    });
  });
}
// ===== API ROUTES =====

// POST /api/htlc/fund
app.post('/api/htlc/fund', async (req, res) => {
  try {
    const { out, err } = await runNode('npx', [
      'hardhat', 'run', 'localhost-script/htlc/fund.js', '--network', 'localhost'
    ]);
    res.json({ ok: true, out, err });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err });
  }
});

// POST /api/htlc/create
app.post('/api/htlc/create', async (req, res) => {
  try {
    const { buyId } = req.body ?? {};
    const env = { ...process.env };
    if (buyId !== undefined && buyId !== null) env.BUY_ID = String(buyId);
    const { out, err } = await runNode('npx', [
      'hardhat', 'run', 'localhost-script/htlc/createHTLC.js', '--network', 'localhost'
    ], { env });
    res.json({ ok: true, out, err });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err });
  }
});

// GET /api/htlc/view
app.get('/api/htlc/view', async (_req, res) => {
  try {
    const { out, err } = await runNode('npx', [
      'hardhat', 'run', 'localhost-script/htlc/viewHTLC.js', '--network', 'localhost'
    ]);
    res.json({ ok: true, out, err });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err });
  }
});

// POST /api/htlc/withdraw
app.post('/api/htlc/withdraw', async (req, res) => {
  try {
    const { buyId } = req.body ?? {};
    const env = { ...process.env };
    if (buyId !== undefined && buyId !== null) env.BUY_ID = String(buyId);

    const { out, err } = await runNode(
      'npx',
      ['hardhat', 'run', 'localhost-script/htlc/withdrawHTLC.js', '--network', 'localhost'],
      { env }
    );

    res.json({ ok: true, out, err });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, out: e.out, err: e.err });
  }
});


// Optional: 404 for unknown /api routes
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ===== SPA CATCH-ALL =====
// Use a RegExp to match everything that does NOT start with /api
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// --- start ---
const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
