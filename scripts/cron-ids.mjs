import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;
const p = spawn(helper, ['config', 'cron', 'current', 'list'], { shell: true });
p.stdin.write('{}'); p.stdin.end();
let out = '', err = '';
p.stdout.on('data', (d) => (out += d));
p.stderr.on('data', (d) => (err += d));
p.on('close', (c) => {
  try {
    const j = JSON.parse(out);
    const arr = j.data || [];
    for (const it of arr) console.log(it.id, '|', it.name, '|', it.enabled, '|', (it.target?.payload?.text || '').slice(0, 60).replace(/\n/g, ' '));
  } catch (e) { console.log('RAW', (out + err).slice(0, 1500)); }
});
