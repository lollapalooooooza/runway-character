import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { createRunwayCharacterAdapter } from '../dist/src/adapter.js';

const port = Number(process.env.PORT || 4318);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

async function loadOpenClawRunwayConfig() {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const text = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(text);
  return parsed?.plugins?.entries?.['runway-character']?.config || {};
}

const pluginCfg = await loadOpenClawRunwayConfig();
const adapter = createRunwayCharacterAdapter({
  apiKey: pluginCfg.apiKey,
  baseUrl: pluginCfg.baseUrl,
  timeoutMs: pluginCfg.timeoutMs,
  maxRetries: pluginCfg.maxRetries,
  pollIntervalMs: pluginCfg.pollIntervalMs,
  defaultAspectRatio: pluginCfg.defaultAspectRatio,
  dataRootDir: path.join(os.homedir(), '.openclaw', 'data'),
  debug: pluginCfg.debug,
});

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/') {
      const html = await fs.readFile(path.join(publicDir, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/avatar/live-session') {
      const body = await readBody(req);
      const { avatarId } = body;
      if (!avatarId) return sendJson(res, 400, { error: 'avatarId is required' });

      const created = await adapter.executeTool('create_realtime_session', { avatarId });
      if (!created.ok) return sendJson(res, 500, created);

      const sessionId = created.data.session.id;
      const waited = await adapter.executeTool('wait_for_realtime_session', {
        sessionId,
        timeoutMs: 90000,
        pollIntervalMs: 2000,
        maxAttempts: 45,
      });
      if (!waited.ok) return sendJson(res, 500, waited);

      const consumed = await adapter.executeTool('consume_realtime_session', { sessionId });
      if (!consumed.ok) return sendJson(res, 500, consumed);

      const credentials = consumed.data.credentials;
      return sendJson(res, 200, credentials);
    }

    if (req.method === 'POST' && url.pathname === '/api/avatar/create') {
      const body = await readBody(req);
      const result = await adapter.executeTool('create_live_avatar', body);
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, port });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`Runway live demo server listening on http://localhost:${port}`);
});

process.on('SIGINT', async () => {
  await adapter.close();
  server.close(() => process.exit(0));
});
