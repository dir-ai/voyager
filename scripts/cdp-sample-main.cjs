// Profiler di campionamento sul main process (inspector 9229) — trova le funzioni hot
async function main() {
  await new Promise((r) => setTimeout(r, 15000)); // aspetta regime
  // recupera l'url del debugger dal endpoint json
  const info = await (await fetch('http://127.0.0.1:9229/json/list')).json();
  const wsUrl = info[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); } };
  ws.onerror = () => { console.error('ws error'); process.exit(1); };
  ws.onopen = async () => {
    await send('Profiler.enable');
    await send('Profiler.setSamplingInterval', { interval: 1000 }); // 1ms
    await send('Profiler.start');
    await new Promise((r) => setTimeout(r, 5000));
    const { profile } = await send('Profiler.stop');
    const byId = new Map();
    for (const n of profile.nodes) byId.set(n.id, n);
    const self = new Map();
    for (const s of profile.samples || []) self.set(s, (self.get(s) || 0) + 1);
    const agg = new Map();
    for (const [nodeId, count] of self) {
      const n = byId.get(nodeId);
      if (!n) continue;
      const key = (n.callFrame.functionName || '(anonymous)') + ' @ ' + (n.callFrame.url || '').replace(/^.*[\\/]/, '') + ':' + n.callFrame.lineNumber;
      agg.set(key, (agg.get(key) || 0) + count);
    }
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log('samples total:', total, '(', (total / 1000).toFixed(1), 's @1kHz )');
    for (const [k, v] of [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(String(v).padStart(6), (100 * v / total).toFixed(1) + '%', k);
    }
    process.exit(0);
  };
}
main().catch((e) => { console.error('fail', e.message || e); process.exit(1); });
