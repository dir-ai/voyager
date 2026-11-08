// Riproduce attività UI: reload renderer + navigazione, poi misura CPU main/renderer
async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json().catch(() => null);
  if (!list) { console.log('no 9223 (this instance runs without CDP env) — skip UI sim'); process.exit(0); }
  const page = list.find((t) => t.type === 'page') ?? list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  ws.onopen = async () => {
    await send('Runtime.enable');
    for (let i = 0; i < 5; i++) {
      await send('Page.enable');
      await send('Page.reload');
      await new Promise((r) => setTimeout(r, 4000));
    }
    console.log('UI activity simulated');
    process.exit(0);
  };
}
main();
