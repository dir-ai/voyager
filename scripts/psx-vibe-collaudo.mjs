import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const session = await r.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
const org = 'a0878014-77ce-4057-b855-cb3f7175a790';
const post = (p, b, method = 'POST') => fetch('https://dev.psxworkbench.com' + p, { method, headers: { cookie, 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });

const r1 = await post('/api/vibe/sessions', { organizationId: org, title: 'Collaudo Sync VOYAGER' });
const b1 = await r1.json();
console.log('create:', r1.status, JSON.stringify(b1).slice(0, 120));
const sid = b1.session?.id;

const msgs = [
  { id: 'm-1', role: 'user', content: 'ciao Voyager', timestamp: '2026-11-05T10:00:00.000Z' },
  { id: 'm-2', role: 'assistant', content: 'ciao! come posso aiutare?', timestamp: '2026-11-05T10:00:05.000Z' },
];
const r2 = await post('/api/vibe/chat-history', { organizationId: org, sessionId: sid, messages: msgs });
console.log('save:', r2.status);
const msgs2 = [...msgs, { id: 'm-3', role: 'user', content: 'continua', timestamp: '2026-11-05T10:01:00.000Z' }];
const r3 = await post('/api/vibe/chat-history', { organizationId: org, sessionId: sid, messages: msgs2 });
console.log('save+append:', r3.status);

const r4 = await fetch(`https://dev.psxworkbench.com/api/vibe/chat-history?organizationId=${org}&sessionId=${sid}`, { headers: { cookie } });
const b4 = await r4.json();
console.log('readback:', r4.status, 'count:', (b4.messages || []).length, 'ids:', (b4.messages || []).map((m) => m.id).join(','));

const r5 = await fetch(`https://dev.psxworkbench.com/api/vibe/sessions?organizationId=${org}`, { headers: { cookie } });
const b5 = await r5.json();
console.log('list:', r5.status, 'count:', (b5.sessions || []).length);

const r6 = await post(`/api/vibe/sessions?sessionId=${sid}&organizationId=${org}`, null, 'DELETE');
console.log('delete:', r6.status);
const r7 = await fetch(`https://dev.psxworkbench.com/api/vibe/chat-history?organizationId=${org}&sessionId=${sid}`, { headers: { cookie } });
const b7 = await r7.json();
console.log('post-delete count:', (b7.messages || []).length);
