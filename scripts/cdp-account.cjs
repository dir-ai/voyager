const { spawn } = require('child_process');

const child = spawn('bun run dev', {
  cwd: 'C:/dev/AionUi-fork',
  env: { ...process.env, AIONUI_BACKEND_BIN: 'C:\\dev\\AionUi-fork\\resources\\bundled-aioncore\\win32-x64\\aioncore.exe', VOYAGER_DEBUG_CDP: '1' },
  shell: true,
});
child.stdout.on('data', () => {});
child.stderr.on('data', () => {});

setTimeout(() => {
  fetch('http://127.0.0.1:9223/json/list').then((r) => r.json()).then(async (list) => {
    const page = list.find((t) => t.type === 'page') ?? list[0];
    console.log('URL:', page.url);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve) => {
      const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params }));
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        console.log('[EXCEPTION]', (d.exception?.description || d.text || '').slice(0, 500));
      }
    };
    ws.onopen = async () => {
      await send('Runtime.enable');
      const base = page.url.split('#')[0].split('?')[0].replace(/\/$/, '');
      // hash router first
      const r1 = await send('Runtime.evaluate', { expression: `location.href='${base}#/settings/account'; 'nav-hash'` });
      console.log('nav hash:', r1.result?.result?.value);
      await new Promise((res) => setTimeout(res, 6000));
      let h = await send('Runtime.evaluate', { expression: "document.body.innerText.slice(0,400)" });
      let text = h.result?.result?.value || '';
      if (!/Account|Accedi|Sign/.test(text)) {
        // history router
        await send('Runtime.evaluate', { expression: `history.pushState({},'','${base}/settings/account'.replace(location.origin,'')); window.dispatchEvent(new PopStateEvent('popstate')); 'nav-hist'` });
        await new Promise((res) => setTimeout(res, 3500));
        h = await send('Runtime.evaluate', { expression: "document.body.innerText.slice(0,400)" });
        text = h.result?.result?.value || '';
      }
      console.log('PAGE TEXT:', JSON.stringify(text));
      process.exit(0);
    };
  }).catch((e) => console.log('CDP fail:', String(e)));
}, 30000);
