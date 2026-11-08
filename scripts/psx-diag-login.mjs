// Diagnosi login: prova le credenziali fornite contro Supabase DEV (solo lettura, nessuna modifica)
const SUPA = 'https://supabase.psxworkbench.com';
const ANON = process.env.VOYAGER_SUPA_ANON;
if (!ANON) { console.error('anon key missing'); process.exit(1); }
const [email, pass] = process.argv.slice(2);

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
console.log('HTTP', r.status);
const body = await r.json().catch(() => ({}));
if (r.ok) {
  console.log('LOGIN OK user_id=', body.user?.id, 'email=', body.user?.email, 'expires_in=', body.expires_in);
} else {
  console.log('ERROR', JSON.stringify(body).slice(0, 500));
}
