// Quick check via CDP: renderer vivo e contenuto visibile (niente white screen)
const http = require('http');
const fetchJson = (path) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: 9223, path }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
});
const send = (ws, id, method, params) => new Promise((res, rej) => {
  const WebSocket = require('ws');
  const w = new WebSocket(ws);
  w.on('open', () => w.send(JSON.stringify({ id, method, params })));
  w.on('message', (m) => { const j = JSON.parse(m); if (j.id === id) { w.close(); res(j.result); } });
  w.on('error', rej);
});
(async () => {
  const pages = (await fetchJson('/json/list')).filter((t) => t.type === 'page');
  const p = pages[0];
  if (!p) { console.log('NESSUNA PAGINA'); process.exit(1); }
  const r = await send(p.webSocketDebuggerUrl, 1, 'Runtime.evaluate', { expression: 'document.body.innerText.length', returnByValue: true });
  const t = await send(p.webSocketDebuggerUrl, 2, 'Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  console.log('titolo:', t.result.value, '| testo visibile:', r.result.value, 'caratteri');
})();
