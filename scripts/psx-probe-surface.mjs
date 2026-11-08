import fs from 'node:fs';

const envPath = 'C:/dev/AionUi-fork/.voyager-company.local.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const login = await fetch('https://supabase.psxworkbench.com/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD }),
});
const session = await login.json();
const cookie = `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const H = { cookie };

for (const path of ['/api/user/orgs', '/api/crm/aziende?organization_id=a0878014-77ce-4057-b855-cb3f7175a790']) {
  const res = await fetch(`https://dev.psxworkbench.com${path}`, { headers: H });
  const text = await res.text();
  console.log(path, '->', res.status, text.replace(/\s+/g, ' ').slice(0, 400));
}

// scoperta: aziende -> sedi -> reparti (catena gerarchica con id richiesti)
const aziende = await (await fetch('https://dev.psxworkbench.com/api/crm/aziende?organization_id=a0878014-77ce-4057-b855-cb3f7175a790', { headers: H })).json();
const az = (Array.isArray(aziende) ? aziende : aziende.aziende)?.[0];
const azId = az?.id ?? az?.azienda_id;
console.log('azienda[0]:', JSON.stringify(az).slice(0, 300), 'id:', azId);
if (azId) {
  const sedi = await (await fetch(`https://dev.psxworkbench.com/api/crm/sedi?azienda_id=${azId}`, { headers: H })).json();
  const sede = (Array.isArray(sedi) ? sedi : sedi.sedi)?.[0];
  const sedeId = sede?.id ?? sede?.sede_id;
  console.log('sede[0]:', JSON.stringify(sede).slice(0, 300), 'id:', sedeId);
  if (sedeId) {
    const rep = await fetch(`https://dev.psxworkbench.com/api/crm/reparti?sede_id=${sedeId}`, { headers: H });
    console.log('reparti ->', rep.status, (await rep.text()).replace(/\s+/g, ' ').slice(0, 400));
  }
}
