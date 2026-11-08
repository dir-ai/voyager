// VOYAGER — scarica l'installer pubblicato su PSX (canale stable) su file reale + verifica sha256
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const BASE = 'https://dev.psxworkbench.com';
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');

const mr = await fetch(`${BASE}/api/voyager/distribuzione/latest?canale=stable`, { headers: { cookie } });
const body = await mr.json().catch(() => null);
const m = body?.manifest;
if (!mr.ok || !m?.versione) { console.log('manifest:', mr.status, JSON.stringify(body)); process.exit(1); }
console.log('manifest:', m.versione, m.nome_file, m.sha256?.slice(0, 16) + '...', m.size_bytes);

const dr = await fetch(`${BASE}/api/voyager/distribuzione/download?canale=stable&versione=${encodeURIComponent(m.versione)}`, { headers: { cookie } });
if (!dr.ok) { console.log('download:', dr.status, await dr.text()); process.exit(1); }
const out = new URL(`../out/${m.nome_file}`, import.meta.url);
fs.mkdirSync(new URL('../out', import.meta.url), { recursive: true });
await pipeline(Readable.fromWeb(dr.body), fs.createWriteStream(out));

const buf = fs.readFileSync(out);
const hash = crypto.createHash('sha256').update(buf).digest('hex');
const ok = hash === m.sha256;
console.log('file:', out.pathname ? out : out, `${buf.length} byte`);
console.log('sha256 locale :', hash);
console.log('sha256 manifest:', m.sha256);
console.log(ok ? 'SHA256 OK ✅' : 'SHA256 DIVERSO ❌');
process.exit(ok ? 0 : 1);
