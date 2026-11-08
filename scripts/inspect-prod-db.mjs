import Database from 'node:sqlite';
const db = new Database.DatabaseSync('C:/Users/dir/AppData/Roaming/AionUi/aionui/aionui-backend.db', { readOnly: true });
const rows = db.prepare('SELECT id, platform, name, base_url, models, capabilities FROM providers').all();
for (const r of rows) console.log(JSON.stringify(r).slice(0, 400));
