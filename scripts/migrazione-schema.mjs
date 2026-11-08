// Schema dei 5 blocchi migrazione (sola lettura)
import { Database } from 'bun:sqlite';
const dbPath = process.argv[2] || 'C:\\Users\\dir\\AppData\\Roaming\\AionUi\\aionui\\aionui-backend.db';
const db = new Database(dbPath, { readonly: true });
for (const t of ['providers', 'assistants', 'assistant_definitions', 'conversations', 'messages', 'skills', 'mcp_servers', 'system_settings', 'client_preferences']) {
  console.log(`\n== ${t} ==`);
  for (const c of db.prepare(`PRAGMA table_info("${t}")`).all()) console.log(`${c.name} ${c.type}${c.pk ? ' PK' : ''}`);
}
console.log('\n== providers sample ==');
for (const r of db.prepare('SELECT id, name, platform, base_url, capabilities FROM providers LIMIT 5').all()) console.log(JSON.stringify(r));
console.log('\n== assistants sample ==');
for (const r of db.prepare('SELECT * FROM assistants LIMIT 3').all()) console.log(JSON.stringify(r).slice(0, 400));
