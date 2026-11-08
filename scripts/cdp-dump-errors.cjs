// Dump errori console + JS exception del renderer via CDP
const http = require('http');
const WebSocket = require('ws');
const fetchJson = (path) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: 9223, path }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
});
(async () => {
  const pages = (await fetchJson('/json/list')).filter((t) => t.type === 'page');
  const w = new WebSocket(pages[0].webSocketDebuggerUrl);
  const events = [];
  let id = 0;
  w.on('open', () => {
    w.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
    w.send(JSON.stringify({ id: ++id, method: 'Log.enable' }));
    w.send(JSON.stringify({ id: ++id, method: 'Runtime.evaluate', params: { expression: 'location.pathname' } }));
    setTimeout(() => w.close(), 8000);
  });
  w.on('message', (m) => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type)) {
      events.push(j.params.type + ': ' + j.params.args.map((a) => a.value || a.description || a.type).join(' ').slice(0, 300));
    }
    if (j.method === 'Runtime.exceptionThrown') {
      events.push('EXCEPTION: ' + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text).slice(0, 400));
    }
    if (j.method === 'Log.entryAdded' && j.params.entry.level === 'error') {
      events.push('LOG: ' + j.params.entry.text.slice(0, 300));
    }
    if (j.id === 3 && j.result) events.push('PATH: ' + j.result.result?.value);
  });
  w.on('close', () => { console.log(events.join('\n') || 'NESSUN EVENTO'); process.exit(0); });
})();
