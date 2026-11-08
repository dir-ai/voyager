// Bun CDP client: capture renderer console errors from the VOYAGER dev window.
const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page' && /index\.html|localhost/.test(t.url)) ?? list[0];
console.log('target:', page?.title, page?.url);
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    console.log('[console.' + msg.params.type + ']', msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 500));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    console.log('[EXCEPTION]', (d.exception?.description || d.text || '').slice(0, 900));
  }
};
ws.onopen = async () => {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload');
  setTimeout(() => process.exit(0), 8000);
};
