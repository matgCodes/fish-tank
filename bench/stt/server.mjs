// Local server for the speech-to-text bench. No dependencies.
// Serves the page on localhost (Web Speech needs a secure context) and mints
// single-use AssemblyAI streaming tokens so the API key never reaches the page.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(dir, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ASSEMBLYAI_API_KEY || '';
const TOKEN_URL = 'https://streaming.assemblyai.com/v3/token';
const EXPIRES_IN_SECONDS = 600;
const MAX_SESSION_SECONDS = 1800; // sessions bill wall-clock; cap each at 30 minutes

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/analysis.js': ['analysis.js', 'text/javascript; charset=utf-8'],
};

// The docs checked on 2026-09-12 show GET with query parameters. The earlier
// research note said POST, so fall back to POST and log both responses.
async function mintToken() {
  const query = new URLSearchParams({
    expires_in_seconds: String(EXPIRES_IN_SECONDS),
    max_session_duration_seconds: String(MAX_SESSION_SECONDS),
  });
  const get = await fetch(`${TOKEN_URL}?${query}`, {
    headers: { Authorization: KEY },
    signal: AbortSignal.timeout(8000),
  });
  const getBody = await get.text();
  if (get.ok) return JSON.parse(getBody).token;
  console.warn(`[token] GET returned ${get.status}: ${getBody.slice(0, 300)}. Trying POST.`);

  const post = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expires_in_seconds: EXPIRES_IN_SECONDS, max_session_duration_seconds: MAX_SESSION_SECONDS }),
    signal: AbortSignal.timeout(8000),
  });
  const postBody = await post.text();
  if (post.ok) {
    console.warn('[token] POST worked. Update the research note and this server.');
    return JSON.parse(postBody).token;
  }
  console.warn(`[token] POST returned ${post.status}: ${postBody.slice(0, 300)}`);
  throw new Error(`token mint failed: GET ${get.status}, POST ${post.status}`);
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && FILES[pathname]) {
      const [file, type] = FILES[pathname];
      return send(res, 200, type, await readFile(path.join(dir, file)));
    }
    if (req.method === 'GET' && pathname === '/token') {
      if (!KEY) {
        return send(res, 503, 'application/json', JSON.stringify({ error: 'ASSEMBLYAI_API_KEY is not set on the bench server' }));
      }
      try {
        const token = await mintToken();
        return send(res, 200, 'application/json', JSON.stringify({ token }));
      } catch (err) {
        console.warn(`[token] ${err.message}`);
        return send(res, 502, 'application/json', JSON.stringify({ error: err.message }));
      }
    }
    return send(res, 404, 'text/plain; charset=utf-8', 'not found');
  } catch (err) {
    console.error(err);
    return send(res, 500, 'text/plain; charset=utf-8', 'server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Speech-to-text bench: http://localhost:${PORT}`);
  console.log(KEY ? 'AssemblyAI key loaded.' : 'No ASSEMBLYAI_API_KEY. Web Speech works; AssemblyAI will show "no API key".');
});
