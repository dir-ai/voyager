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
        console.log('[EXCEPTION]', (d.exception?.description || d.text || '').slice(0, 800));
        (d.stackTrace?.callFrames || []).slice(0, 10).forEach((f) =>
          console.log('   at', (f.functionName || '?') + ' ' + (f.url || '').split('/').slice(-2).join('/') + ':' + f.lineNumber + ':' + f.columnNumber));
      }
    };
    ws.onopen = async () => {
      await send('Runtime.enable');
      await send('Page.enable');
      await send('Page.reload');
      setTimeout(async () => {
        const r = await send('Runtime.evaluate', { expression: "window.history.pushState({},'','/settings/account'); window.dispatchEvent(new PopStateEvent('popstate')); 'ok'" });
        setTimeout(async () => {
          const h = await send('Runtime.evaluate', { expression: "document.body.innerText.slice(0,400)" });
          console.log('PAGE TEXT:', JSON.stringify(h.result?.result?.value));
          process.exit(0);
        }, 5000);
      }, 5000);
    };
  }).catch((e) => console.log('CDP fail:', String(e)));
}, 30000);
