// Misura reattività del renderer VOYAGER (lag event loop + heap) via CDP
async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = list.find((t) => t.type === 'page') ?? list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  ws.onopen = async () => {
    await send('Runtime.enable');
    const expr = `
      (async () => {
        const t0 = performance.now();
        await new Promise((r) => setTimeout(r, 100));
        const lag = Math.round(performance.now() - t0 - 100);
        const mem = performance.memory ? { usedMB: Math.round(performance.memory.usedJSHeapSize / 1e6), limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1e6) } : null;
        return JSON.stringify({ eventLoopLag100ms: lag, mem });
      })()
    `;
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: false, awaitPromise: true });
    console.log('RENDERER:', JSON.stringify(r).slice(0, 500));
    process.exit(0);
  };
}
main();
