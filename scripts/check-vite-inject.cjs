async function main() {
  const r = await fetch('http://localhost:5173/services/companyContract.ts');
  const t = await r.text();
  console.log('anonKey inlined:', t.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'VITE ref present:', t.includes('VITE_SUPABASE_ANON_KEY'));
}
main();
