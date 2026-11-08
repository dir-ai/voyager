import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * VOYAGER rebrand: the backend binary extracts its built-in skills into the
 * data directory on startup, and those SKILL.md files still carry the upstream
 * brand ("AionUi") in prose that gets injected into agent system prompts —
 * which is why agents described themselves as "operating inside AionUi".
 *
 * The binary cannot be edited, and the API refuses to rename generated
 * assistants, so after every backend start we sweep the extracted skill files
 * and rewrite the upstream brand to VOYAGER. Running it after each start also
 * heals any re-extraction the backend performs.
 */

const BRAND_PATTERN = /AionUi/g;
const BRAND_REPLACEMENT = 'VOYAGER';
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

async function walkMarkdownFiles(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdownFiles(full, out);
    } else if (MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

/** Rewrite upstream brand mentions in extracted built-in skill files. Returns patched file count. */
export async function patchBuiltinSkillsBranding(builtinSkillsDir: string, log?: (msg: string) => void): Promise<number> {
  const files: string[] = [];
  await walkMarkdownFiles(builtinSkillsDir, files);
  let patched = 0;
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      if (!BRAND_PATTERN.test(content)) continue;
      BRAND_PATTERN.lastIndex = 0;
      await fs.writeFile(file, content.replace(BRAND_PATTERN, BRAND_REPLACEMENT), 'utf8');
      patched += 1;
    } catch (error) {
      log?.(`[VOYAGER] Failed to patch skill branding in ${file}: ${String(error)}`);
    }
  }
  if (patched > 0) log?.(`[VOYAGER] Rebranded ${patched} built-in skill file(s) in ${builtinSkillsDir}`);
  return patched;
}

/**
 * Patch shortly after the backend starts (the backend extracts built-in skills
 * during its own startup, so we sweep right after it becomes healthy), with one
 * delayed re-run to heal files extracted late.
 */
export function scheduleBuiltinSkillsBrandingPatch(builtinSkillsDir: string, log?: (msg: string) => void): void {
  const run = (): void => {
    void patchBuiltinSkillsBranding(builtinSkillsDir, log).catch((): void => undefined);
  };
  setTimeout(run, 2_000);
  setTimeout(run, 30_000);
}