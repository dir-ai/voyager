import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;
console.log('HELPER_BIN =', helper);
const p = spawn(helper, ['capabilities'], { shell: true });
let out = '', err = '';
p.stdout.on('data', (d) => (out += d));
p.stderr.on('data', (d) => (err += d));
p.on('close', (c) => console.log('CODE', c, (out + err).slice(0, 400)));
