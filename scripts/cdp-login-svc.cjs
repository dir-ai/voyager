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
        const cc = await import('/services/companyContract.ts');
        const key = cc.getSupabaseAnonKey();
        const out = { keyLen: key.length, keyHead: key.slice(0, 10) };
        try {
          const r = await fetch('https://supabase.psxworkbench.com/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { apikey: key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'dir@psxsystem.com', password: 'Tabelion@21', gotrue_meta_security: { captcha_token: 'unsupported' } }),
          });
          out.status = r.status;
          out.body = (await r.text()).slice(0, 300);
        } catch (e) { out.fetchErr = String(e); }
        return JSON.stringify(out);
      })()
    `;
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: false, awaitPromise: true });
    console.log(JSON.stringify(r).slice(0, 900));
    process.exit(0);
  };
}
main();
