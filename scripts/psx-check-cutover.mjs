async function main() {
  const SUPA = 'https://supabase.psxworkbench.com';
  const anon = process.env.VOYAGER_SUPA_ANON;
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'voyager.collaudo@psxworkbench.com', password: 'V0yager!Collaudo2026', gotrue_meta_security: { captcha_token: 'unsupported' } }),
  });
  const session = await r.json();
  const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
  const res = await fetch('https://dev.psxworkbench.com/api/crm/runtime?organization_id=a0878014-77ce-4057-b855-cb3f7175a790', { headers: { cookie } });
  const b = await res.json().catch(() => ({}));
  console.log('READBACK a0878014 post-cutover:', res.status, 'nome:', b?.identitaEStruttura?.configurato?.nome ?? 'n/a', 'reparti:', (b?.identitaEStruttura?.configurato?.reparti || []).length);
}
main();
