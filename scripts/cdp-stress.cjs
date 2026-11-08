async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = list.find((t) => t.type === 'page') ?? list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  ws.onopen = async () => {
    await send('Runtime.enable');
    // naviga tra 5 pagine per esercitare la UI
    const routes = ['/', '/settings/account', '/settings', '/company/founder', '/'];
    for (const r of routes) {
      await send('Runtime.evaluate', { expression: `window.__voynav && window.__voynav('${r}')` });
      await new Promise((res) => setTimeout(res, 1500));
    }
    // long task observer
    const r = await send('Runtime.evaluate', { expression: `
      (async () => {
        if (!window.__lt) {
          window.__lt = [];
          new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ entryTypes: ['longtask'] });
        }
        await new Promise((res) => setTimeout(res, 4000));
        const lt = window.__lt;
        return JSON.stringify({ longTasks: lt.length, worstMs: lt.length ? Math.round(Math.max(...lt)) : 0, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : null });
      })()
    `, returnByValue: false, awaitPromise: true });
    console.log('RENDERER:', JSON.stringify(r).slice(0, 400));
    process.exit(0);
  };
}
main().catch((e) => { console.error(e); process.exit(1); });
