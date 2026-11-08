import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;
const payload = JSON.stringify({
  name: 'Monitor ordini Amazon/eBay/Alibaba',
});
const p = spawn(helper, ['conversation', 'create'], { shell: true });
p.stdin.write(payload); p.stdin.end();
let out = '', err = '';
p.stdout.on('data', (d) => (out += d));
p.stderr.on('data', (d) => (err += d));
p.on('close', (c) => console.log('CODE', c, (out + err).slice(0, 500)));
