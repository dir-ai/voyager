import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CLI = join(here, '..', 'dist', 'cli.js')

function run(args: string[], env: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : err ? 1 : 0
      resolve({ code, stdout, stderr })
    })
  })
}

// Exit-code contract (offline cases only — no network): 2 = tool/usage error.
test('check with no argument → exit 2 (usage)', async () => {
  const r = await run(['check'])
  assert.equal(r.code, 2)
})

test('check with an invalid package name → exit 2 (tool error, not a rejection)', async () => {
  // Name validation happens before any fetch, so this is deterministic offline.
  const r = await run(['check', '!!!not-a-name'])
  assert.equal(r.code, 2)
  assert.match(r.stderr + r.stdout, /could not verify|invalid package name/i)
})

test('VOYAGER_OFF=1 brief prints a notice and exits 0 (not a silent 1)', async () => {
  const r = await run(['brief', 'anything'], { VOYAGER_OFF: '1' })
  assert.equal(r.code, 0)
  assert.match(r.stdout, /disabled/i)
})

test('--version prints the version and exits 0', async () => {
  const r = await run(['--version'])
  assert.equal(r.code, 0)
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/)
})
