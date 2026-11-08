import Database from 'node:sqlite';
const db = new Database.DatabaseSync('C:/Users/dir/AppData/Roaming/AionUi-Dev/aionui/aionui-backend.db');
const rows = db.prepare("SELECT key, value FROM client_preferences WHERE user_id='system_default_user' AND (key LIKE '%model%' OR key LIKE '%provider%' OR key LIKE '%default%' OR key LIKE '%engine%')").all();
for (const r of rows) console.log(r.key, '=', String(r.value).slice(0, 250));
// capability del provider ora
const p = db.prepare("SELECT name, models, capabilities, platform FROM providers WHERE name='PSX API'").get();
console.log('PROVIDER:', JSON.stringify(p).slice(0, 400));
