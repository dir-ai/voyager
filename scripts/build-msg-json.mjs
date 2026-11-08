import fs from 'node:fs';
const msg = fs.readFileSync('C:/dev/AionUi-fork/scripts/tmp-message-to-runtime-session.md', 'utf8').trim();
process.stdout.write(JSON.stringify({ to: 'f0a60710', message: msg }));
