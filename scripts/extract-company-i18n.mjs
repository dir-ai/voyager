// Move nested `company` block out of common.json into a dedicated company.json module
// (bundle key prefix = file name, per i18n convention).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'desktop', 'src', 'renderer', 'services', 'i18n', 'locales');
let companyBlock = null;

for (const lang of fs.readdirSync(root)) {
  const dir = path.join(root, lang);
  if (!fs.statSync(dir).isDirectory()) continue;
  const commonPath = path.join(dir, 'common.json');
  if (fs.existsSync(commonPath)) {
    const json = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
    if (json.company) {
      if (!companyBlock) companyBlock = json.company;
      delete json.company;
      if (Object.keys(json).length === 0) {
        // keep file but empty object is invalid for json schema? just delete file
        fs.rmSync(commonPath);
      } else {
        fs.writeFileSync(commonPath, JSON.stringify(json, null, 2) + '\n');
      }
      console.log('cleaned common.json of', lang);
    }
  }
}

if (!companyBlock) {
  console.error('No company block found!');
  process.exit(1);
}

// Write en-US company.json
const enDir = path.join(root, 'en-US');
fs.writeFileSync(path.join(enDir, 'company.json'), JSON.stringify(companyBlock, null, 2) + '\n');
console.log('wrote en-US/company.json');

console.log('index.ts patched manually via Edit tool');
