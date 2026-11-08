import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;
const oldId = 'cron_01a1adce-996a-7631-9263-f972d10070e0';
function run(payload) {
  return new Promise((resolve) => {
    const p = spawn(helper, ['config', 'cron', 'current', 'update'], { shell: true });
    p.stdin.write(payload); p.stdin.end();
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => resolve({ code: c, out: out + err }));
  });
}
const r = await run(JSON.stringify({
  job_id: oldId,
  name: 'VOYAGER goal loop (15 min) [DEPRECATO]',
  enabled: false,
  schedule: '5 4 29 2 *',
  schedule_description: 'mai (29 febbraio 4:05) — job deprecato',
  message: 'JOB DEPRECATO — sostituito da cron_01a1ae20-54c7-7c32-b155-018ef61904de (goal con matrimonio PSX×Voyager). Non eseguire.',
}));
console.log('UPDATE', r.code, r.out.slice(0, 400));
