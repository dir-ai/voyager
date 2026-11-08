// VOYAGER distribuzione live-check: manifest latest + download autenticato + sha256 compare.
// Usage: node scripts/psx-distribuzione-check.mjs
// Exits 0 if all green, 1 otherwise.
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2])
    .filter(Boolean),
);
const anon = env.VITE_SUPABASE_ANON_KEY;
const EXPECT = '1ffe9f81b5060b4595d81cb4e08af090b6fd20587b5a88714028132cfc34d516';
const EXPECT_SIZE = 250787354;
const EXPECT_NAME = 'VOYAGER-2.3.0-voyager.0-win-x64.exe';
let ok = true;

// login member session
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!lr.ok) { console.log('login:', lr.status); process.exit(1); }
const session = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');

// 1) unauth → 401
const r0 = await fetch('https://dev.psxworkbench.com/api/voyager/distribuzione/latest?canale=stable');
console.log('unauth /latest:', r0.status);
ok &&= r0.status === 401;

// 2) manifest autenticato
const r1 = await fetch('https://dev.psxworkbench.com/api/voyager/distribuzione/latest?canale=stable', { headers: { cookie } });
console.log('auth /latest:', r1.status);
ok &&= r1.status === 200;
const body = await r1.json().catch(() => ({}));
const m = body?.manifest;
console.log('manifest:', m ? `${m.versione} ${m.nome_file} firmato=${m.firmato}` : '(nessuno)');
ok &&= !!m && m.versione === '2.3.0-voyager.0' && m.nome_file === EXPECT_NAME && m.sha256 === EXPECT && m.size_bytes === EXPECT_SIZE && m.firmato === false && m.download_url === null;

// 3) download autenticato stream + sha256 del contenuto
const r2 = await fetch('https://dev.psxworkbench.com/api/voyager/distribuzione/download?canale=stable&versione=2.3.0-voyager.0', { headers: { cookie } });
console.log('auth /download:', r2.status, 'content-length:', r2.headers.get('content-length'));
ok &&= r2.status === 200;
const hsha = (r2.headers.get('x-psx-sha256') || '').toLowerCase();
ok &&= hsha === EXPECT;
// streaming hash (250MB: no buffer intero)
const { Readable } = await import('node:stream');
const { pipeline } = await import('node:stream/promises');
const hash = crypto.createHash('sha256');
let bytes = 0;
await pipeline(Readable.fromWeb(r2.body), async function* (source) {
  for await (const chunk of source) { bytes += chunk.length; hash.update(chunk); yield chunk; }
}, fs.createWriteStream(new URL('../out/.distribuzione-probe.bin', import.meta.url)));
const actual = hash.digest('hex');
console.log('byte:', bytes, 'sha256 contenuto match:', actual === EXPECT);
ok &&= bytes === EXPECT_SIZE && actual === EXPECT;
fs.rmSync(new URL('../out/.distribuzione-probe.bin', import.meta.url), { force: true });
console.log(ok ? 'DISTRIBUZIONE: ALL GREEN' : 'DISTRIBUZIONE: FAIL');
process.exit(ok ? 0 : 1);
