import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node patch-skill-branding.mjs <builtin-skills-dir>'); process.exit(1); }
let patched = 0, scanned = 0;
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(md|mdx|txt)$/i.test(e.name)) {
      scanned++;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('AionUi')) {
        fs.writeFileSync(full, src.replace(/AionUi/g, 'VOYAGER'), 'utf8');
        patched++;
        console.log('patched:', path.relative(root, full));
      }
    }
  }
}
walk(root);
console.log(`scanned ${scanned} files, patched ${patched}`);
