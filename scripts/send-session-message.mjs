import { spawn } from 'node:child_process';
import fs from 'node:fs';

const msg = fs.readFileSync('C:/dev/AionUi-fork/scripts/tmp-message-to-runtime-session.md', 'utf8').trim();
const payload = JSON.stringify({ to: 'f0a60710', message: msg });
const bin = process.env.AIONUI_HELPER_BIN;
if (!bin) { console.error('AIONUI_HELPER_BIN missing'); process.exit(1); }
const child = spawn(bin, ['session', 'send-message'], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.write(payload);
child.stdin.end();
