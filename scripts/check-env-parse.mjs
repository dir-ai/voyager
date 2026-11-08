// Verifica __dirname e env parsing nel contesto reale della config electron-vite
import { resolve } from 'node:path';
console.log('dirname:', import.meta.dirname ?? '(no import.meta.dirname)');
console.log('envDir resolved:', resolve((import.meta.dirname ?? process.cwd()) + '/packages/desktop', '../..'));
console.log('cwd:', process.cwd());
