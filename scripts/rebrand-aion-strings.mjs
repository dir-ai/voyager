import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/AionUi-fork/packages/desktop/src';

// 1) Insert rebrandAgentName import after the last import line of each target file.
const targets = [
  'renderer/pages/conversation/components/ChatConversation.tsx',
  'renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx',
  'renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
  'renderer/utils/model/agentTypes.ts',
  'renderer/pages/conversation/components/ChatLayout/index.tsx',
  'renderer/pages/team/components/TeamAgentIdentity.tsx',
  'renderer/pages/cron/ScheduledTasksPage/jobAgentMeta.ts',
  'renderer/pages/settings/AssistantSettings/assistantUtils.ts',
  'renderer/pages/settings/AgentSettings/AgentCard.tsx',
  'renderer/pages/settings/AgentSettings/BoundAssistants.tsx',
  'renderer/pages/settings/AgentSettings/InlineAgentEditor.tsx',
  'renderer/pages/guid/components/AssistantSelectionArea.tsx',
];
for (const rel of targets) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('utils/brand/rebrand')) continue;
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import /.test(lines[i])) lastImport = i;
  }
  if (lastImport === -1) { console.log('NO IMPORTS', rel); continue; }
  lines.splice(lastImport + 1, 0, "import { rebrandAgentName } from '@renderer/utils/brand/rebrand';");
  fs.writeFileSync(file, lines.join('\n'));
  console.log('import added:', rel);
}

// 2) Locale sweep: replace brand strings in all locale JSON files.
const localesDir = path.join(root, 'renderer/services/i18n/locales');
const replacements = [
  [/Aion\s*CLI/g, 'Voyager CLI'],
  [/Aion\s*Hub/g, 'Voyager Hub'],
  [/Aion\s*Core/g, 'Voyager Core'],
  [/AionUi/g, 'VOYAGER'],
  [/Aion\s*UI/g, 'VOYAGER'],
  [/\bAion\b/g, 'Voyager'],
];
let total = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.json')) {
      let src = fs.readFileSync(p, 'utf8');
      let count = 0;
      for (const [re, to] of replacements) {
        src = src.replace(re, (m) => { count++; return to; });
      }
      if (count) {
        fs.writeFileSync(p, src);
        total += count;
        console.log(`locales: ${path.relative(localesDir, p)} -> ${count} replacements`);
      }
    }
  }
}
walk(localesDir);
console.log('TOTAL locale replacements:', total);
