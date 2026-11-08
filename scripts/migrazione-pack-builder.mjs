// VOYAGER migrazione — Step 2: builder pacchetti 'migrazione-1' (DRY-RUN locale).
// Legge il DB vecchio in SOLA LETTURA ed emette i pacchetti dei 5 blocchi su disco
// (scripts/migrazione-out/) per ispezione. Nessun invio: le API PSX (avvia/blocco/chiudi)
// non sono ancora live. VINCOLI: segreti NELLA pacchetto MAI (api_key_encrypted esclusa,
// deposito vault a parte), permessi MAI (Available ≠ Granted), episodica MAI.
//
// Formato pacchetto (contratto CLIENT RUNTIME, docs/runtime-v2/CONTRATTO_MIGRAZIONE_DATI.md):
//   { schema_version:'migrazione-1', richiesta_id, tipo_blocco, hash_sha256, origine_dichiarata, carico }
// hash_sha256 = sha256 della serializzazione canonica del carico (JSON keys sorted, no spazi).
//
// Usage: bun scripts/migrazione-pack-builder.mjs [db-path] [--out dir]
import { Database } from 'bun:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:\\Users\\dir\\AppData\\Roaming\\AionUi\\aionui\\aionui-backend.db';
const outDir = (() => {
  const i = process.argv.indexOf('--out');
  return i > 0 ? process.argv[i + 1] : 'scripts/migrazione-out';
})();
const ORIGINE = 'voyager-old-client-aionui'; // origine_dichiarata
const RICH = process.env.MIGRAZIONE_RICHIESTA_ID
  || (() => { try { return fs.readFileSync('scripts/.migrazione-richiesta-id.txt', 'utf8').trim(); } catch { return ''; } })();
const MIG_ID = process.env.MIGRAZIONE_ID || crypto.randomUUID();

fs.mkdirSync(outDir, { recursive: true });
const db = new Database(dbPath, { readonly: true });

const canone = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const pacchetto = (tipo, carico) => {
  const canon = canone({ ...carico, _tipo: tipo });
  const richiesta_id = crypto.randomUUID();
  return {
    schema_version: 'migrazione-1',
    richiesta_id,
    tipo_blocco: tipo,
    hash_sha256: sha(canon),
    origine_dichiarata: ORIGINE,
    carico,
  };
};

const J = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const written = [];

// ── BLOCCO 1: provider (senza segreti) ─────────────────────────────
const providers = db.prepare('SELECT * FROM providers').all().map((p) => ({
  id_locale: p.id,
  name: p.name,
  platform: p.platform,
  base_url: p.base_url,
  models: J(p.models, []),
  capabilities: J(p.capabilities, []),
  context_limit: p.context_limit,
  enabled: !!p.enabled,
  is_full_url: !!p.is_full_url,
  model_enabled: J(p.model_enabled, []),
  model_settings: J(p.model_settings, {}),
  created_at: p.created_at,
  updated_at: p.updated_at,
  // segreto: NON incluso — deposito VAULT separato (endpoint dedicato non loggato)
  api_key: { stato: 'VAULT_DEPOSIT_REQUIRED' },
}));
const pk1 = pacchetto('provider_api_keys', { providers });
written.push([`${outDir}/blocco-1-provider.json`, pk1]);

// ── BLOCCO 2: assistenti (formato 'aionui-1', identico al canary Nestor) ──
const assistants = db.prepare('SELECT * FROM assistants').all().map((a) => ({
  id_locale: a.id,
  name: a.name,
  description: a.description,
  avatar: a.avatar,
  enabled_skills: J(a.enabled_skills, []),
  custom_skill_names: J(a.custom_skill_names, []),
  disabled_builtin_skills: J(a.disabled_builtin_skills, []),
  prompts: J(a.prompts, null),
  models: J(a.models, null),
  name_i18n: J(a.name_i18n, null),
  description_i18n: J(a.description_i18n, null),
  prompts_i18n: J(a.prompts_i18n, null),
  created_at: a.created_at,
  updated_at: a.updated_at,
  definitions: db.prepare('SELECT * FROM assistant_definitions WHERE assistant_id=? AND deleted_at IS NULL').all(a.id)
    .map((d) => ({ ...d, carico_note: 'snapshot lossless riga' })),
  preferences: db.prepare(`SELECT p.* FROM assistant_preferences p JOIN assistant_definitions d ON p.assistant_definition_id=d.id WHERE d.assistant_id=?`).all(a.id)
    .map((d) => ({ ...d, carico_note: 'snapshot lossless riga' })),
}));
// ── BLOCCO 2: assistenti — WRAPPER aionui-1 (lettera-29): {schema_version,
// external_identity, nome, config_originale = righe DB RAW lossless} ──
const raw_assistant_by_id = new Map(db.prepare('SELECT * FROM assistants').all().map((a) => [a.id, a]));
const exports2 = db.prepare('SELECT * FROM assistants').all().map((a) => {
  const raw = { ...raw_assistant_by_id.get(a.id) };
  raw.definitions = db.prepare('SELECT * FROM assistant_definitions WHERE assistant_id=? AND deleted_at IS NULL').all(a.id);
  raw.preferences = db.prepare(`SELECT p.* FROM assistant_preferences p JOIN assistant_definitions d ON p.assistant_definition_id=d.id WHERE d.assistant_id=?`).all(a.id);
  return {
    schema_version: 'aionui-1',
    external_identity: { assistant_id: a.id, assistant_kind: 'custom' },
    nome: a.name,
    config_originale: raw,
  };
});
const pk2 = pacchetto('assistenti_aionui_1', { assistants, exports: exports2 });
written.push([`${outDir}/blocco-2-assistenti.json`, pk2]);

// ── BLOCCO 3: conversazioni (lettera-32: canone {chiave, title?, messages:[{role, content, timestamp?}]},
// max 5.000 msg per conversazione → conversazioni >5k spezzate in più righe con chiave -pNN) ──
const roleMap = (type, position) =>
  type === 'text' ? (position === 'right' ? 'user' : 'assistant')
  : type === 'thinking' ? 'assistant'
  : type === 'tips' ? 'assistant' // lettera A-48: tips = contenuto assistant (non system)
  : 'tool'; // tool_call / acp_tool_call
const convs = db.prepare('SELECT * FROM conversations').all();
const msgStmt = db.prepare('SELECT id, conversation_id, msg_id, type, content, position, status, hidden, created_at, backend_turn_id FROM messages WHERE conversation_id=? ORDER BY created_at');
const out3 = fs.createWriteStream(path.join(outDir, 'blocco-3-conversazioni.jsonl'), 'utf8');
let convCount = 0, msgCount = 0, splitCount = 0, emptyCount = 0;
const MAX_MSG = 5000;
for (const c of convs) {
  const messages = msgStmt.all(c.id)
    .map((m) => ({ role: roleMap(m.type, m.position), content: m.content ?? '', timestamp: m.created_at }))
    .filter((m) => m.content.length > 0)
    // canone server: content stringa non vuota 1..100.000 caratteri (lettera-32).
    // Il contenuto oltre tetto viene troncato con marcatore esplicito, non scartato.
    .map((m) => {
      const LIMITE = 100000;
      if (m.content.length <= LIMITE) return m;
      const marcatore = '\n[contenuto troncato: superava il tetto canone di 100.000 caratteri]';
      return { ...m, content: m.content.slice(0, LIMITE - marcatore.length) + marcatore };
    });
  if (!messages.length) { emptyCount++; continue; }
  const parts = Math.ceil(messages.length / MAX_MSG);
  for (let pi = 0; pi < parts; pi++) {
    const msgs = messages.slice(pi * MAX_MSG, (pi + 1) * MAX_MSG);
    convCount++; msgCount += msgs.length;
    if (parts > 1) splitCount++;
    out3.write(JSON.stringify({
      chiave: parts > 1 ? `${c.id}-p${pi + 1}` : c.id,
      title: c.title || `(senza titolo)`, // vibe_chat_sessions.title NOT NULL (lettera-32 collaudo)
      origine_dichiarata: ORIGINE,
      messages: msgs,
    }) + '\n');
  }
}
out3.end();
console.log(`blocco-3-conversazioni.jsonl: ${convCount} conversazioni (spezzate: ${splitCount}), ${msgCount} messaggi, vuote scartate: ${emptyCount}`);

// ── BLOCCO 4: skills/MCP (stato iniziale capacità, mai più del vero) ──
const skills = db.prepare('SELECT * FROM skills WHERE deleted_at IS NULL').all().map((s) => ({
  id_locale: s.id, name: s.name, description: s.description, path: s.path, source: s.source,
  enabled: !!s.enabled, stato_capacita: 'CONFIGURED',
}));
const mcps = db.prepare('SELECT * FROM mcp_servers WHERE deleted_at IS NULL').all().map((m) => ({
  id_locale: m.id, name: m.name, description: m.description, enabled: !!m.enabled,
  transport_type: m.transport_type,
  // transport_config può contenere segreti: MAI nel pacchetto — deposito vault
  transport_config: { stato: 'VAULT_DEPOSIT_REQUIRED' },
  original_json: { stato: 'VAULT_DEPOSIT_REQUIRED' },
  tools: J(m.tools, []),
  stato_capacita: m.last_connected ? 'PROVEN_CONNESSIONE' : 'CONFIGURED',
  builtin: !!m.builtin,
}));
const pk4 = pacchetto('skills_mcp', { skills, mcps });
written.push([`${outDir}/blocco-4-skills-mcp.json`, pk4]);

// ── BLOCCO 5: impostazioni — canone NS-18/23 ESATTO (lettera A-56, lib/psx/impostazioni-registro.ts) ──
// Validator legge SOLO preferenze; 11 chiavi whitelist. Mappatura dal legacy documentata
// nel report finale (chiavi non in canone → system_settings scalari o drop con nota).
const systemSettingsRows = db.prepare('SELECT * FROM system_settings').all();
const clientPrefsRows = db.prepare('SELECT * FROM client_preferences').all();
const legacySys = systemSettingsRows[0] ?? {};
const legacyPrefs = Object.fromEntries(clientPrefsRows.map((r) => [r.key, r.value]));

// valore legacy (spesso JSON-encoded) → scalare canone (stringa|numero|booleano, stringa ≤1000)
const scalare = (v) => {
  let x = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { /* stringa nuda */ } }
  if (typeof x === 'string') return x.length <= 1000 ? x : x.slice(0, 997) + '…[troncato canone 1000]';
  if (typeof x === 'number' || typeof x === 'boolean') return x;
  return JSON.stringify(x)?.slice(0, 997) + (JSON.stringify(x)?.length > 997 ? '…[troncato canone 1000]' : '');
};
const registraNota = (nota) => noteImpostazioni.push(nota);
const noteImpostazioni = [];

// tema: da theme.activeId ('dark-theme'/'dark'→dark, 'light*'→light, 'system'→system)
const rawTema = scalare(legacyPrefs['theme.activeId'] ?? 'system');
const tema = /dark/.test(rawTema) ? 'dark' : /light/.test(rawTema) ? 'light' : 'system';
// lingua: canone solo 'it'|'en'; legacy 'en-US' → default 'it' (nota; l'originale resta in system_settings)
const rawLingua = String(scalare(legacyPrefs['language'] ?? legacySys.language ?? 'it')).toLowerCase();
const lingua = rawLingua.startsWith('en') ? 'en' : rawLingua.startsWith('it') ? 'it' : 'it';
if (rawLingua && !['it', 'en'].includes(rawLingua)) registraNota(`lingua legacy '${rawLingua}' fuori canone → default 'it'; originale in system_settings.language`);
// enabled_order: da assistants.enabledOrder (lista ID agenti, JSON array di stringhe)
const enabledOrderRaw = (() => { try { return JSON.parse(legacyPrefs['assistants.enabledOrder'] ?? '[]'); } catch { return []; } })();
const enabled_order = (Array.isArray(enabledOrderRaw) ? enabledOrderRaw : [])
  .filter((x) => typeof x === 'string' && x.length >= 1 && x.length <= 200).slice(0, 50);
// notifiche: da system_settings.notification_enabled
const notifiche = !!(legacySys.notification_enabled ?? 1);
// mcp_enabled: il legacy non ha chiavi mcp.* in client_preferences (stato MCP migrato
// org-level in capacita con PROVEN_CONNESSIONE) → non presente in canone, annotato.
registraNota('mcp_enabled omesso: legacy non ha mcp.* in client_preferences; stato MCP migrato org-level nel blocco capacita (PROVEN_CONNESSIONE)');
// last_skill_ids/last_mcp_ids: assenti dal legacy → omessi (nota)
registraNota('last_skill_ids/last_mcp_ids omessi: assenti dal legacy');

// system_settings: Record a chiavi arbitrarie, valori scalari ≤200 voci.
// Contiene: campi scalari della riga system_settings (senza user_id/updated_at),
// + tutte le chiavi client_preferences come valori scalari decodificati,
// + agents.homeOrder/promptHistory se presenti e ≤1000 char (A-56: altrimenti drop con nota).
const system_settings = {};
for (const [k, v] of Object.entries(legacySys)) {
  if (['user_id', 'updated_at'].includes(k)) continue;
  if (['string', 'number', 'boolean'].includes(typeof v)) system_settings[k] = v;
}
for (const [k, v] of Object.entries(legacyPrefs)) {
  const s = scalare(v);
  if (String(s).length <= 1000) system_settings[k] = s;
  else registraNota(`client_preferences '${k}' oltre 1000 char → drop (cronologia/non strutturale)`);
}
const chiaviSys = Object.keys(system_settings).slice(0, 200);

// folders/projects: canone {id, name, created_at?} — SOLO queste 3 chiavi, stringhe 1..200.
// Legacy folders = associazioni folder→risorsa: id=folder_id, name=basename(resource_uri).
const folders = db.prepare('SELECT * FROM folders').all().map((r) => ({
  id: String(r.folder_id ?? r.id),
  name: String(r.resource_uri ?? '').split(/[\\/]/).filter(Boolean).pop() ?? String(r.folder_id ?? r.id),
  created_at: r.created_at != null ? new Date(Number(r.created_at)).toISOString() : undefined,
})).slice(0, 500);
const projects = db.prepare('SELECT * FROM projects').all().map((r) => ({
  id: String(r.project_id ?? r.id),
  name: String(r.name ?? r.project_id ?? r.id).slice(0, 200),
  created_at: r.created_at != null ? new Date(Number(r.created_at)).toISOString() : undefined,
})).slice(0, 500);

const preferenze = {
  tema, lingua, enabled_order, notifiche, system_settings: Object.fromEntries(chiaviSys.map((k) => [k, system_settings[k]])),
  client_preferences: {}, folders, projects,
};
const caricoImpostazioni = { preferenze };
const pk5 = pacchetto('impostazioni_snapshot', caricoImpostazioni);
pk5.note_canone = noteImpostazioni;
written.push([`${outDir}/blocco-5-impostazioni.json`, pk5]);

for (const [file, pkt] of written) {
  fs.writeFileSync(file, JSON.stringify(pkt, null, 2));
  const size = fs.statSync(file).size;
  console.log(`${path.basename(file)}: ${size} B, richiesta_id=${pkt.richiesta_id.slice(0, 8)}…, hash=${pkt.hash_sha256.slice(0, 12)}…`);
}
console.log(`\nMIGRAZIONE_ID sessione: ${MIG_ID}`);
console.log('DRY-RUN completato — pacchetti ispezionabili, nessun invio (API PSX non ancora live).');
