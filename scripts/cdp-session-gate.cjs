async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = list.find((t) => t.type === 'page') ?? list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  ws.onopen = async () => {
    await send('Runtime.enable');
    await new Promise((r) => setTimeout(r, 8000));
    const r = await send('Runtime.evaluate', { expression: `
      (async () => {
        const s = await import('/services/workbenchSession.ts');
        const st = s.getWorkbenchSessionState();
        const text = document.body.innerText.slice(0, 400);
        return JSON.stringify({ sessionStatus: st.status, hasSession: !!st.session, body: text });
      })()
    `, returnByValue: false, awaitPromise: true });
    console.log(JSON.stringify(r).slice(0, 700));
    process.exit(0);
  };
}
main().catch((e) => { console.error('fail', e); process.exit(1); });
