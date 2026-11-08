// VOYAGER migrazione — Step 1: lettura SOLO LETTURA del DB vecchio + inventario pacchetti migrazione-1.
// Nessuna scrittura: apre il DB in readonly e stampa l'inventario dei 5 blocchi.
// Usage: bun scripts/migrazione-inventario.mjs [percorso-db-vecchio]
import { Database } from 'bun:sqlite';

const dbPath = process.argv[2] || 'C:\\Users\\dir\\AppData\\Roaming\\AionUi\\aionui\\aionui-backend.db';
const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
console.log('== TABELLE ==');
console.log(tables.join('\n'));

for (const t of tables) {
  try {
    const n = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c;
    console.log(`${t}: ${n} righe`);
  } catch { console.log(`${t}: (errore conteggio)`); }
}
