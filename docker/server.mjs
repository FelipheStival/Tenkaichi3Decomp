// Servidor local do jogo com as salas online (Dragon Net Battle), para jogar na mesma rede ou numa VPN
// (Hamachi, Tailscale, ZeroTier...). Junta o que port/web/serve.mjs faz (página, disco por range requests,
// chave de acesso) com as salas de cloudflare/src/room.js, que no Cloudflare são Durable Objects.
//
//   node docker/server.mjs <porta> <imagem do disco>
//
// Todo acesso precisa da chave (port/build/lan.key): o link leva ?k=<chave> uma vez e o navegador guarda um cookie.
// Mande o link só para quem tem o jogo.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { WebSocketServer } = createRequire('/opt/net/')('ws');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../port/build/web');
const port = +(process.argv[2] || 4500), iso = process.argv[3];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json',
                '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
const KEY_FILE = path.resolve(ROOT, '../lan.key');
const key = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, 'utf8').trim() : crypto.randomBytes(18).toString('base64url');
fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });

const authorized = (req, url) => {
  if (url.searchParams.get('k') === key) return 'set';
  const cookie = /(?:^|;\s*)bt3k=([\w-]+)/.exec(req.headers.cookie || '');
  if (cookie && cookie[1] === key) return 'ok';
  return /^\/(icon-\d+\.png|manifest\.webmanifest)$/.test(url.pathname) ? 'ok' : null; // (nada do jogo nesses)
};

// ---------------------------------------------------------------------------------------------- página e disco

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const auth = authorized(req, url);
  if (!auth) { res.writeHead(403).end('forbidden'); return; }
  if (auth === 'set') res.setHeader('Set-Cookie', `bt3k=${key}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
  if (url.pathname === '/telemetry' || url.pathname === '/net/stat') { req.resume(); res.writeHead(204).end(); return; }
  if (url.pathname === '/net/log') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end(''); return; }
  let file, type;
  if (url.pathname === '/disc.iso') {
    if (!iso || !fs.existsSync(iso)) { res.writeHead(404).end('no disc image given to the server'); return; }
    file = iso; type = 'application/octet-stream';
  } else {
    file = path.join(ROOT, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('not found'); return; }
    type = TYPES[path.extname(file)] || 'application/octet-stream';
  }
  const fail = (e) => { console.error(`${url.pathname}: ${e.message}`); if (!res.headersSent) res.writeHead(500); res.end(String(e.message)); };
  const size = fs.statSync(file).size, range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (range) {
    const a = +range[1], b = range[2] ? Math.min(+range[2], size - 1) : size - 1;
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    fs.createReadStream(file, { start: a, end: b }).on('error', fail).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'Content-Length': size });
    fs.createReadStream(file).on('error', fail).pipe(res);
  }
});

// ---------------------------------------------------------------- salas online (como cloudflare/src/room.js)
//
//   /net/ws?room=CODE&role=host|join&phase=lobby|session&name=...&cid=...   uma sala
//   /net/queue?name=...&cid=...                                             Quick Match
//
// Mensagens de texto (JSON) são o lobby e a sinalização do WebRTC, repassadas ao outro jogador; mensagens binárias
// são os pacotes do jogo quando os dois navegadores não se conectam direto (o relay).

const ROLES = ['host', 'join'];
const rooms = new Map();   // código -> Set de sockets ({role, phase, name, cid} em ws.info)
const queue = new Set();   // Quick Match: sockets esperando ({q, name, cid, t, matched})
const send = (ws, m) => { try { ws.send(typeof m === 'string' || Buffer.isBuffer(m) ? m : JSON.stringify(m)); } catch (e) {} };
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const roomOf = (code) => { if (!rooms.has(code)) rooms.set(code, new Set()); return rooms.get(code); };
const others = (room, role) => [...room].filter((o) => o.info.role === (role === 'host' ? 'join' : 'host'));

function joinRoom(ws, url) {
  const code = url.searchParams.get('room') || '';
  const role = url.searchParams.get('role');
  const phase = url.searchParams.get('phase') === 'session' ? 'session' : 'lobby';
  const name = (url.searchParams.get('name') || 'Player').slice(0, 16);
  const cid = (url.searchParams.get('cid') || '').slice(0, 40);
  if (!/^[A-Z]{4}$/.test(code) || !ROLES.includes(role)) { ws.close(1008, 'bad request'); return; }
  const room = roomOf(code);
  ws.info = { role, phase, name, cid };
  // o mesmo papel já aqui: o mesmo jogador de novo (reload) substitui; outro qualquer é recusado
  for (const o of room) {
    if (o.info.role !== role) continue;
    if (o.info.cid && o.info.cid === cid) { o.info.replaced = true; o.close(4000, 'replaced'); room.delete(o); continue; }
    send(ws, { t: role === 'host' ? 'taken' : 'full' });
    ws.close(4001, 'taken');
    return;
  }
  const other = others(room, role).find((o) => o.info.phase === phase);
  if (!other && role === 'join' && phase === 'lobby') { send(ws, { t: 'nohost' }); ws.close(4002, 'no host'); return; }
  room.add(ws);
  if (other) { send(ws, { t: 'peer', name: other.info.name }); send(other, { t: 'peer', name }); }
  else send(ws, { t: 'wait' });

  ws.on('message', (msg, binary) => {
    const to = others(room, role).filter((o) => o.info.phase === phase);
    if (binary) { for (const o of to) send(o, msg); return; } // pacotes do jogo (relay)
    let m;
    try { m = JSON.parse(msg.toString()); } catch (e) { return; }
    if (m.t === 'ping') { send(ws, { t: 'pong', ts: m.ts }); return; }
    if (['sig', 'go', 'relay', 'bye'].includes(m.t)) for (const o of to) send(o, msg.toString());
  });
  ws.on('close', (codeNum) => {
    room.delete(ws);
    if (!room.size) rooms.delete(code);
    if (ws.info.replaced || [4000, 4001, 4002].includes(codeNum)) return;
    for (const o of others(room, role)) if (o.info.phase === phase) send(o, { t: 'left' });
  });
}

const waiting = () => [...queue].filter((ws) => !ws.info.matched && ws.readyState === 1);
const count = () => { const w = waiting(); for (const ws of w) send(ws, { t: 'count', n: w.length }); };

function quickMatch(ws, url) {
  const name = (url.searchParams.get('name') || 'Player').slice(0, 16);
  const cid = (url.searchParams.get('cid') || '').slice(0, 40);
  ws.info = { q: 1, name, cid, t: Date.now() };
  for (const o of waiting()) if (cid && o.info.cid === cid) { o.info.matched = 1; o.close(4000, 'replaced'); }
  const rivals = waiting().sort((a, b) => a.info.t - b.info.t);
  queue.add(ws);
  if (rivals.length) {
    const other = rivals[0];
    const room = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    const rules = String(3 << 8); // luta simples, 240 segundos: o padrão do jogo
    other.info.matched = ws.info.matched = 1;
    send(other, { t: 'match', room, role: 'host', vs: name, rules });
    send(ws, { t: 'match', room, role: 'join', vs: other.info.name, rules });
  }
  count();
  ws.on('message', (msg) => { if (msg.toString().includes('ping')) send(ws, { t: 'pong' }); });
  ws.on('close', () => { queue.delete(ws); count(); });
}

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname === '/net/ws' ? joinRoom : url.pathname === '/net/queue' ? quickMatch : null;
  if (!route || !authorized(req, url)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  wss.handleUpgrade(req, socket, head, (ws) => route(ws, url));
});

server.listen(port, '0.0.0.0', () => console.log(`servidor na porta ${port} (disco: ${iso || 'nenhum'}), salas online ativas`));
