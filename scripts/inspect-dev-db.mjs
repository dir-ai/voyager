import Database from 'node:sqlite';
const db = new Database.DatabaseSync('C:/Users/dir/AppData/Roaming/AionUi-Dev/aionui/aionui-backend.db', { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES:', tables.map((t) => t.name).join(', '));
for (const t of tables.map((x) => x.name)) {
  if (/model|provider|agent|setting/i.test(t)) {
    try {
      const rows = db.prepare(`SELECT * FROM ${t} LIMIT 3`).all();
      for (const r of rows) console.log(t, JSON.stringify(r).slice(0, 500));
    } catch {}
  }
}
