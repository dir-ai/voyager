import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const bin = process.env.AIONUI_HELPER_BIN;
const body = fs.readFileSync('C:/dev/AionUi-fork/tmp-message-to-runtime-session.md', 'utf8');
const payload = JSON.stringify({ to: 'f0a60710', message: body });
const res = spawnSync(bin, ['session', 'send-message'], { input: payload, encoding: 'utf8', shell: false });
console.log('stdout:', res.stdout);
console.log('stderr:', res.stderr);
console.log('status:', res.status);
