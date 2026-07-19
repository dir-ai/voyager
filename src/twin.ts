// Voyager — proof-in-twin for packages (Pillar 1).
//
// THE KILLER IDEA, in its smallest honest form: before recommending a package,
// don't trust the registry — REPRODUCE it. Install the package and smoke-import
// it. What a PASS proves is narrow: the package installs and its entrypoint
// LOADS ("runtime smoke passed"). It is NOT a safety proof. Pass promotes the
// claim from BELIEF to a twin-reproduced result; skip/fail keeps it a BELIEF
// (still OSV-gated), never silently promoted.
//
// ── Security model ────────────────────────────────────────────────────────────
// The only step that RUNS the package's own code is the smoke import(). That step
// executes inside a HARDENED, ROOTLESS CONTAINER:
//   --network none        no egress — a hostile package cannot exfiltrate
//   --read-only + tmpfs   no writes to the host filesystem
//   -v dir:/twin:ro       node_modules mounted read-only; no host home/creds
//   --user 65534:65534    non-root (nobody)
//   --cap-drop ALL + no-new-privileges
//   --pids-limit/--memory/--cpus  bounded blast radius
// The install step runs on the host but with --ignore-scripts (no lifecycle-script
// RCE) and downloads/unpacks only — it does not execute the package's module code.
//
// If NO container runtime (podman/docker) is present, the twin does NOT fall back
// to running package code on the host: it returns 'unsupported'. The pre-1.1 host
// execution is available ONLY behind an explicit, documented VOYAGER_TWIN_HOST=1
// (dangerous: the import then runs with the user's privileges and can read files,
// open sockets, spawn processes).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { voyagerTwinEnabled, VOYAGER_TWIN_OFF_REASON } from './config.js'
import type { PackageQuery } from './types.js'

const execFileAsync = promisify(execFile)

// The container image the smoke import runs in. Pinned to a small Node image;
// overridable for air-gapped mirrors.
const TWIN_IMAGE = process.env.VOYAGER_TWIN_IMAGE || 'node:22-alpine'

// Env for the host INSTALL subprocess: only what npm needs, no API keys/secrets.
// (The install does not execute package code; the container import gets a clean
// env with nothing from the host.)
function installEnv(): NodeJS.ProcessEnv {
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
  /** True only when install + import both succeeded. */
  proved: boolean
  /** True when the package code ran inside the hardened container (not the host). */
  isolated?: boolean
  /** Version actually installed (ground truth, may differ from the query). */
  installedVersion?: string
  reason?: string
  detail?: string
}

const MAX_OUT = 4096

// Belt-and-suspenders: names/versions are interpolated into argv (shell:false, no
// shell injection) but we still reject anything that isn't a valid npm name +
// optional @version, so a malformed claim can't smuggle flags.
const SAFE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i
const SAFE_VERSION = /^[a-z0-9][a-z0-9-._+]*$/i

/** Detect a container runtime — prefer rootless podman, then docker. */
async function detectContainerRuntime(): Promise<'podman' | 'docker' | null> {
  for (const rt of ['podman', 'docker'] as const) {
    try {
      await execFileAsync(rt, ['--version'], { timeout: 10_000, shell: false })
      return rt
    } catch {
      /* not installed — try the next */
    }
  }
  return null
}

/** The bounded require/import probe run inside the twin (CJS with an ESM fallback). */
function smokeProbe(name: string): string {
  const n = JSON.stringify(name)
  return (
    `(async () => { try { require(${n}) } ` +
    `catch (e) { if (e && e.code === 'ERR_REQUIRE_ESM') { await import(${n}) } else throw e } ` +
    `console.log('VOYAGER_TWIN_OK') })().catch((e) => { console.error(e && e.message || e); process.exit(1) })`
  )
}

/**
 * Reproduce a package in a disposable twin: install (host, no scripts) + smoke
 * import (hardened container). npm only for now (PyPI twin is roadmap). Returns
 * 'skipped' when the opt-in flag is off, 'unsupported' when no container runtime
 * is available (and the host-exec escape hatch is not set) so the caller degrades
 * to a BELIEF cleanly.
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

  const runtime = await detectContainerRuntime()
  const hostFallback = process.env.VOYAGER_TWIN_HOST === '1'
  if (!runtime && !hostFallback) {
    return {
      status: 'unsupported',
      proved: false,
      reason: 'no container runtime (podman/docker) — refusing to execute package code on the host. Install podman/docker, or set VOYAGER_TWIN_HOST=1 to opt into host execution (DANGEROUS).',
    }
  }

  const spec = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name
  // Under the OS temp dir — NEVER the consumer's cwd (would pollute / get committed).
  const dir = path.join(os.tmpdir(), '.voyager-twin', `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const timeout = Math.min(Math.max(opts.timeoutMs ?? 60_000, 5_000), 180_000)

  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'voyager-twin', private: true }), 'utf8')

    // 1) Install — no lifecycle scripts (RCE vector), no save, bounded. Download +
    //    unpack only; the package's module code does NOT run here.
    try {
      await execFileAsync('npm', ['install', spec, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: dir, timeout, maxBuffer: 4 * 1024 * 1024, env: installEnv(), shell: false,
      })
    } catch (e: unknown) {
      const x = e as { stderr?: string; message?: string; killed?: boolean }
      if (x.killed) return { status: 'timeout', proved: false, reason: `install timeout ${timeout}ms` }
      return {
        status: 'failed', proved: false, reason: 'install failed',
        detail: (x.stderr ?? x.message ?? '').split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300),
      }
    }

    const installedVersion = await readInstalledVersion(dir, pkg.name)

    // 2) Smoke import — the ONLY step that runs the package's own code.
    const result = runtime
      ? await smokeInContainer(runtime, dir, pkg.name)
      : await smokeOnHost(dir, pkg.name) // VOYAGER_TWIN_HOST=1 only

    return { ...result, installedVersion, isolated: Boolean(runtime) }
  } catch (e: unknown) {
    return { status: 'error', proved: false, reason: (e as Error)?.message?.slice(0, 200) ?? 'twin error' }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Run the smoke import inside a hardened, network-isolated, read-only container. */
async function smokeInContainer(runtime: 'podman' | 'docker', dir: string, name: string): Promise<TwinResult> {
  const args = [
    'run', '--rm',
    '--network', 'none',
    '--read-only',
    '--tmpfs', '/tmp',
    '--user', '65534:65534',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', '128',
    '--memory', '512m',
    '--cpus', '1',
    '-v', `${dir}:/twin:ro`,
    '-w', '/twin',
    TWIN_IMAGE,
    'node', '-e', smokeProbe(name),
  ]
  try {
    const { stdout } = await execFileAsync(runtime, args, { timeout: 60_000, maxBuffer: 1 * 1024 * 1024, shell: false })
    return /VOYAGER_TWIN_OK/.test(stdout)
      ? { status: 'proved', proved: true }
      : { status: 'failed', proved: false, reason: 'import not confirmed' }
  } catch (e: unknown) {
    const x = e as { stderr?: string; message?: string; killed?: boolean }
    if (x.killed) return { status: 'timeout', proved: false, reason: 'container smoke timeout' }
    const detail = (x.stderr ?? x.message ?? '').slice(0, MAX_OUT).split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300)
    // A missing image / runtime error is a tool failure, not a package verdict.
    if (/Unable to find image|no such image|pull access|cannot connect|permission denied/i.test(detail)) {
      return { status: 'error', proved: false, reason: 'container runtime error', detail }
    }
    return { status: 'failed', proved: false, reason: 'import failed', detail }
  }
}

/** DANGEROUS host execution — only reached with VOYAGER_TWIN_HOST=1. */
async function smokeOnHost(dir: string, name: string): Promise<TwinResult> {
  try {
    const { stdout } = await execFileAsync(process.execPath, ['-e', smokeProbe(name)], {
      cwd: dir, timeout: 20_000, maxBuffer: 1 * 1024 * 1024, env: installEnv(), shell: false,
    })
    return /VOYAGER_TWIN_OK/.test(stdout)
      ? { status: 'proved', proved: true, reason: 'host execution (VOYAGER_TWIN_HOST=1) — NOT isolated' }
      : { status: 'failed', proved: false, reason: 'import not confirmed (host)' }
  } catch (e: unknown) {
    const x = e as { stderr?: string; message?: string }
    return {
      status: 'failed', proved: false, reason: 'import failed (host)',
      detail: (x.stderr ?? x.message ?? '').slice(0, MAX_OUT).split('\n').filter(Boolean).slice(-3).join(' · ').slice(0, 300),
    }
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
