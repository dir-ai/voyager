import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;
const payload = JSON.stringify({ conversation_id: 'a430da01' });
const p = spawn(helper, ['config', 'cron', 'current', 'list'], { shell: true });
p.stdin.write(payload); p.stdin.end();
let out = '', err = '';
p.stdout.on('data', (d) => (out += d));
p.stderr.on('data', (d) => (err += d));
p.on('close', (c) => console.log('CODE', c, (out + err).slice(0, 2000)));
