import { spawn } from 'node:child_process';
const child = spawn(process.env.AIONUI_HELPER_BIN, ['diagnose', 'conversations', 'get'], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.write(JSON.stringify({ conversation_id: 'f0a60710' }));
child.stdin.end();
