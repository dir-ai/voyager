// Read-back integrale finale + chiudi migrazione (GO UNICO, A-54/A-56)
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const BASE = 'https://dev.psxworkbench.com';
const rich = fs.readFileSync(new URL('.migrazione-richiesta-id.txt', import.meta.url), 'utf8').trim();
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');

const r = await fetch(`${BASE}/api/migrazione/${rich}`, { headers: { cookie } });
const b = await r.json();
const bl = b.stato.blocchi;
const acc = {};
for (const x of bl) {
  const k = `${x.tipo}:${x.esito}`;
  acc[k] = (acc[k] || 0) + 1;
  if (x.tipo !== 'conversazioni') console.log(x.tipo, x.esito, 'conteggio=' + x.conteggio, 'scarti=' + (x.scarti || []).length);
}
console.log(JSON.stringify(acc), 'blocchi:', bl.length);
const scarti = bl.flatMap((x) => (x.scarti || []).map((sc) => ({ ...sc, blocco: x.hash_sha256.slice(0, 8) })));
console.log('scarti totali:', scarti.length);

for (const url of [`${BASE}/api/migrazione/${rich}/chiudi`, `${BASE}/api/migrazione/chiudi`]) {
  for (const corpo of [{ richiestaId: rich }, { id: rich }, { richiesta_id: rich }]) {
    const cr = await fetch(url, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const cb = await cr.json().catch(() => null);
    const err = cb?.errore ?? '';
    console.log('CHIUDI', url.replace(BASE, ''), JSON.stringify(Object.keys(corpo))[0] ? Object.keys(corpo).join('+') : '', '→', cr.status, err || JSON.stringify(cb).slice(0, 300));
    if (cr.status === 200) process.exit(0);
  }
}
