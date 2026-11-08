// Verifica in-app del login con le credenziali utente (via CDP su app dev già in esecuzione)
const run = async () => {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = list.find((t) => t.type === 'page') ?? list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  ws.onopen = async () => {
    await send('Runtime.enable');
    // naviga: Settings -> Account
    const nav = `
      const find = (txt) => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === txt);
      const s = find('Settings'); if (s.length) s[s.length - 1].click();
      'settings:' + (s.length > 0);
    `;
    const nv = await send('Runtime.evaluate', { expression: nav, returnByValue: true });
    console.log('nav:', nv.result?.result?.value);
    await new Promise((r) => setTimeout(r, 2500));
    const nav2 = `
      const items = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === 'Account');
      if (items.length) { items[items.length - 1].click(); 'account clicked'; } else { 'no Account item'; }
    `;
    const nv2 = await send('Runtime.evaluate', { expression: nav2, returnByValue: true });
    console.log('nav2:', nv2.result?.result?.value);
    await new Promise((r) => setTimeout(r, 2000));
    // riempi i campi (React: native setter + input event)
    const fill = `
      const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      const inputs = document.querySelectorAll('input');
      setVal(inputs[0], 'dir@psxsystem.com');
      setVal(inputs[1], 'Tabelion@21');
      inputs.length;
    `;
    const n = await send('Runtime.evaluate', { expression: fill, returnByValue: true });
    console.log('inputs filled:', n.result?.result?.value);
    // click su Sign in
    const click = `
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((x) => x.textContent.trim() === 'Sign in');
      if (b) { b.click(); 'clicked'; } else { 'no button'; }
    `;
    const c = await send('Runtime.evaluate', { expression: click, returnByValue: true });
    console.log('click:', c.result?.result?.value);
    await new Promise((r) => setTimeout(r, 6000));
    const t = await send('Runtime.evaluate', { expression: "document.body.innerText.slice(0, 700)", returnByValue: true });
    console.log('PAGE AFTER LOGIN:', JSON.stringify(t.result?.result?.value));
    process.exit(0);
  };
};
run().catch((e) => { console.error('fail', e); process.exit(1); });
