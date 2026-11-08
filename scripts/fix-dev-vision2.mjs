import Database from 'node:sqlite';
const db = new Database.DatabaseSync('C:/Users/dir/AppData/Roaming/AionUi-Dev/aionui/aionui-backend.db');
db.prepare("UPDATE providers SET platform = 'custom' WHERE name = 'PSX API'").run();
console.log('platform restored to custom');
for (const t of ['system_settings', 'client_preferences']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all();
  console.log(t, cols.map((c) => c.name).join(', '));
}
const s1 = db.prepare('SELECT * FROM system_settings LIMIT 5').all();
for (const r of s1) console.log('SYS', JSON.stringify(r).slice(0, 300));
const s2 = db.prepare('SELECT * FROM client_preferences LIMIT 5').all();
for (const r of s2) console.log('PREF', JSON.stringify(r).slice(0, 300));
