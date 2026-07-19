// Voyager — minimal proof-in-twin for packages (Pillar 1, F0 slice).
//
// THE KILLER IDEA, in its smallest honest form: before recommending a package,
// don't trust the registry — REPRODUCE it. Install the package into a disposable
// sandbox and smoke-import it. Pass → the claim is a twin-proved FACT. Skip/fail
// → it stays a BELIEF (still OSV-gated), never silently promoted.
//
// ── Security ─────────────────────────────────────────────────────────────────
//  1. OPT-IN. Requires VOYAGER_TWIN=1 — set ONLY on a trusted, single-tenant
//     or local machine (it runs `npm install` of the queried package). Default
//     OFF → returns 'skipped', so a claim stays an OSV-gated BELIEF.
//  2. ISOLATED temp dir under os.tmpdir()/.voyager-twin/, installed with
//     --no-save --ignore-scripts (no lifecycle-script RCE), hard timeout,
//     always cleaned up.
//  3. SANITIZED env (sandboxEnv): only what npm needs — nothing to exfiltrate.
//  4. SMOKE only — a bounded require()/import() of the installed package; no
//     arbitrary code beyond npm's install of a named, OSV-cleared package.
// A clean seam to later swap npm-in-tmp for `podman run` (a real container).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { voyagerTwinEnabled, VOYAGER_TWIN_OFF_REASON } from './config.js'
import type { PackageQuery } from './types.js'

const execFileAsync = promisify(execFile)

// Sanitized env for the install/smoke subprocess: pass only what npm needs to
// run, and nothing to exfiltrate (no API keys, no secrets from the parent env).
function sandboxEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    NODE_ENV: process.env.NODE_ENV,
    TMPDIR: process.env.TMPDIR,
  }
}

export type TwinStatus = 'proved' | 'failed' | 'timeout' | 'skipped' | 'error' | 'unsupported'

export interface TwinResult {
  status: TwinStatus
  /** True only when install + import both succeeded — the FACT condition. */
  proved: boolean
  /** Version actually installed (ground truth, may differ from the query). */
  installedVersion?: string
  reason?: string
  detail?: string
}

const MAX_OUT = 4096

// Belt-and-suspenders: the package name is interpolated into argv (shell:false,
// so no shell injection) but we still reject anything that isn't a valid
// npm/PyPI name + optional @version, so a malformed claim can't smuggle flags.
const SAFE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i
const SAFE_VERSION = /^[a-z0-9][a-z0-9-._+]*$/i

/**
 * Reproduce a package in a disposable twin: install + smoke-import. npm only in
 * F0 (PyPI twin is F2). Returns 'skipped' when the opt-in flag is off so the
 * caller degrades to a BELIEF cleanly.
 */
export async function provePackageInTwin(pkg: PackageQuery, opts: { timeoutMs?: number } = {}): Promise<TwinResult> {
  if (!voyagerTwinEnabled()) {
    return { status: 'skipped', proved: false, reason: VOYAGER_TWIN_OFF_REASON }
  }
  if (pkg.ecosystem !== 'npm') {
    return { status: 'unsupported', proved: false, reason: 'twin probe supports npm only for now (PyPI is roadmap)' }
  }
  if (!SAFE_NAME.test(pkg.name) || (pkg.version && !SAFE_VERSION.test(pkg.version))) {
    return { status: 'error', proved: false, reason: 'invalid package name/version' }
  }

  const spec = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name
  // Under the OS temp dir — NEVER the consumer's cwd (would pollute / get committed).
  const dir = path.join(os.tmpdir(), '.voyager-twin', `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const timeout = Math.min(Math.max(opts.timeoutMs ?? 60_000, 5_000), 180_000)
  const env = sandboxEnv()

  try {
    await fs.mkdir(dir, { recursive: true })
    // Minimal package.json so npm installs into THIS dir, not a parent.
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'voyager-twin', private: true }), 'utf8')

    // 1) Install — no lifecycle scripts (RCE vector), no save, bounded.
    try {
      await execFileAsync('npm', ['install', spec, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: dir, timeout, maxBuffer: 4 * 1024 * 1024, env, shell: false,
      })
    } catch (e: unknown) {
      const x = e as { stderr?: string; message?: string; killed?: boolean }
      if (x.killed) return { status: 'timeout', proved: false, reason: `install timeout ${timeout}ms` }
      return {
        status: 'failed', proved: false, reason: 'install failed',
        detail: (x.stderr ?? x.message ?? '').split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300),
      }
    }

    // 2) Smoke import — require the package by name from the twin; on ERR_REQUIRE_ESM
    // fall back to dynamic import() so a modern ESM-only package isn't falsely
    // rejected. shell:false, bounded.
    try {
      const name = JSON.stringify(pkg.name)
      const probe =
        `(async () => { try { require(${name}) } ` +
        `catch (e) { if (e && e.code === 'ERR_REQUIRE_ESM') { await import(${name}) } else throw e } ` +
        `console.log('VOYAGER_TWIN_OK') })().catch((e) => { console.error(e && e.message || e); process.exit(1) })`
      const { stdout } = await execFileAsync(process.execPath, ['-e', probe], {
        cwd: dir, timeout: 20_000, maxBuffer: 1 * 1024 * 1024, env, shell: false,
      })
      const proved = /VOYAGER_TWIN_OK/.test(stdout)
      const installedVersion = await readInstalledVersion(dir, pkg.name)
      return proved
        ? { status: 'proved', proved: true, installedVersion }
        : { status: 'failed', proved: false, reason: 'import not confirmed', installedVersion }
    } catch (e: unknown) {
      const x = e as { stderr?: string; message?: string }
      return {
        status: 'failed', proved: false, reason: 'import failed',
        detail: (x.stderr ?? x.message ?? '').slice(0, MAX_OUT).split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300),
      }
    }
  } catch (e: unknown) {
    return { status: 'error', proved: false, reason: (e as Error)?.message?.slice(0, 200) ?? 'twin error' }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function readInstalledVersion(dir: string, name: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, 'node_modules', name, 'package.json'), 'utf8')
    return (JSON.parse(raw) as { version?: string }).version
  } catch {
    return undefined
  }
}
