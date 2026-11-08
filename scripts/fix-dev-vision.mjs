import Database from 'node:sqlite';
const db = new Database.DatabaseSync('C:/Users/dir/AppData/Roaming/AionUi-Dev/aionui/aionui-backend.db');
const caps = JSON.stringify([{ type: 'text' }, { type: 'vision', is_user_selected: true }, { type: 'function_calling' }]);
const r1 = db.prepare("UPDATE providers SET capabilities = ?, platform = 'openai' WHERE name = 'PSX API' AND models LIKE '%glm.chat%'").run(caps);
console.log('providers updated:', r1.changes);
// default model → glm.chat (PSX), così Voyager è vedente di default
const ss = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE '%model%' OR key LIKE '%default%'").all();
for (const s of ss) console.log('SETTING', s.key, '=', String(s.value).slice(0, 200));
const cp = db.prepare("SELECT key, value FROM client_preferences WHERE key LIKE '%model%' OR key LIKE '%default%'").all();
for (const s of cp) console.log('PREF', s.key, '=', String(s.value).slice(0, 200));
