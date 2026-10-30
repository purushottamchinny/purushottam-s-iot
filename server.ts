import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const FLASK_PORT = 5001;
const FLASK_URL = `http://127.0.0.1:${FLASK_PORT}`;

let flaskProcess: ChildProcess | null = null;

function startFlaskBackend() {
  console.log('[Server] Launching Python Flask backend on port', FLASK_PORT);
  flaskProcess = spawn('python3', ['backend/app.py'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(FLASK_PORT),
      HOST: '127.0.0.1',
      PYTHONPATH: '.',
    },
    stdio: 'inherit',
  });

  flaskProcess.on('error', (err) => {
    console.error('[Server] Failed to spawn Flask process:', err);
  });

  flaskProcess.on('exit', (code, signal) => {
    console.log(`[Server] Flask process exited with code ${code} and signal ${signal}`);
  });
}

async function startServer() {
  const app = express();

  // Start Python backend
  startFlaskBackend();

  const apiProxy = createProxyMiddleware({
    target: FLASK_URL,
    changeOrigin: true,
    ws: true,
  });

  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/captured_images') ||
      req.path.startsWith('/socket.io')
    ) {
      return apiProxy(req, res, next);
    }
    next();
  });

  // Health check endpoint
  app.get('/healthz', (req, res) => {
    res.json({ status: 'healthy', dev_port: PORT, backend_port: FLASK_PORT });
  });

  // Attach Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Graceful shutdown
  const cleanup = () => {
    console.log('[Server] Terminating background processes...');
    if (flaskProcess) {
      flaskProcess.kill('SIGTERM');
      flaskProcess = null;
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`======================================================`);
    console.log(` Smart Home Security Applet Running at http://localhost:${PORT}`);
    console.log(` Connected to Python CV Backend at ${FLASK_URL}`);
    console.log(`======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal server startup error:', err);
  process.exit(1);
});
