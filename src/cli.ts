#!/usr/bin/env node
/**
 * voyager CLI — verify a package or produce a cited, OSV-gated brief.
 */
import { voyagerRetrieve } from './index.js'
import { establishPackage } from './establish.js'
import { resolveVoyagerKey, type KeyProvider } from './keys.js'
import type { PackageQuery } from './types.js'
import { VERSION } from './version.js'

function parseArgs(argv: string[]): { flags: Record<string, string | boolean>; positionals: string[] } {
  const boolean = new Set(['twin', 'json'])
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!boolean.has(key) && next !== undefined && !next.startsWith('--')) { flags[key] = next; i++ }
      else flags[key] = true
    } else positionals.push(a)
  }
  return { flags, positionals }
}

const HELP = `voyager v${VERSION} — the verified-brief organ for coding agents

USAGE
  voyager check <name[@version]> [--ecosystem npm|pypi] [--version V] [--twin] [--json]
        Verify a package: registry facts + OSV vuln gate (+ optional twin reproduce).
        Accepts the name@version shorthand (e.g. lodash@4.17.20).
        Exit codes: 0 ok · 1 REJECTED (unsafe) · 2 tool/usage error (no verdict).

  voyager brief "<query>" [--package name] [--discover "<intent>"]
                             [--search "<web query>"] [--docs <library>] [--twin] [--json]
        Produce a cited, confidence-scored, injection-hardened brief.

  voyager discover "<intent>"     GitHub repo discovery (Tier-A).
  voyager search "<query>"        Open-web search (Tier-C, needs a provider key).
  voyager docs <library> [--topic <t>] [--doc-url <official-url>]   Canonical docs (Tier-B).
  voyager doctor                  Which source keys are configured.
  voyager mcp                     Start the stdio MCP server.
  voyager help | --version

The twin (--twin / VOYAGER_TWIN=1) runs \`npm install\` + a smoke import of the
package in a disposable sandbox — it proves installability + that the entrypoint
loads, NOT that the package is safe, and it EXECUTES package code on the host.
Enable it only on a trusted, single-tenant machine.`

function printBrief(rendered: string, json: boolean, brief: unknown): void {
  if (json) console.log(JSON.stringify(brief, null, 2))
  else console.log(rendered)
}

// Retrieval exit code: an intentional VOYAGER_OFF disable is NOT a failure
// (exit 0 with a printed notice), otherwise 0 on a usable brief, 1 on none.
function briefExit(brief: { ok: boolean; notes?: string[] }): number {
  if (brief.notes?.some((n) => /voyager disabled/i.test(n))) return 0
  return brief.ok ? 0 : 1
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2)
  const { flags, positionals } = parseArgs(rest)
  const json = flags.json === true
  const twin = flags.twin === true || process.env.VOYAGER_TWIN === '1'

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return 0
    case '--version':
    case 'version':
      console.log(VERSION)
      return 0

    case 'check': {
      const raw = positionals[0]
      if (!raw) { console.error('check needs a package name.'); return 2 }
      // Support the `name@version` shorthand (and scoped `@scope/name@version`):
      // a version `@` is only meaningful when it is NOT the leading scope `@`.
      const at = raw.lastIndexOf('@')
      const name = at > 0 ? raw.slice(0, at) : raw
      const inlineVersion = at > 0 ? raw.slice(at + 1) : undefined
      // `express@` (trailing @, empty version) is a malformed request, not a
      // non-existent package — a usage error (exit 2), never a false rejection.
      if (inlineVersion === '') {
        console.error(`empty version in "${raw}" — write "${name}" or "${name}@<version>".`)
        return 2
      }
      const ecosystem = (flags.ecosystem === 'pypi' ? 'pypi' : 'npm') as PackageQuery['ecosystem']
      const pkg: PackageQuery = { name, ecosystem, version: typeof flags.version === 'string' ? flags.version : inlineVersion }
      const est = await establishPackage(pkg, { proveInTwin: twin })
      // Exit codes: 0 = ok (fact/belief), 1 = REJECTED (package is unsafe), 2 =
      // TOOL error (registry/network failure — no verdict). CI can then tell an
      // unsafe dependency apart from a broken voyager.
      const exitFor = (e: typeof est): number => (e.error ? 2 : e.verdict === 'rejected' ? 1 : 0)
      if (json) { console.log(JSON.stringify(est, null, 2)); return exitFor(est) }
      if (est.error) {
        console.error(`${name} (${ecosystem}) — could not verify: ${est.error}`)
        return 2
      }
      const c = est.claim
      console.log(`${name} (${ecosystem}) — verdict: ${est.verdict.toUpperCase()}`)
      if (c) {
        console.log(`  ${c.statement}`)
        console.log(`  confidence ${Math.round(c.confidence * 100)}% · sources: ${c.provenance.map((p) => `${p.source}[${p.tier}]`).join(', ')}`)
        if (c.warning) console.log(`  ⚠ ${c.warning}`)
      }
      for (const s of est.steps) console.log(`  ${s.pass ? '✓' : '✗'} ${s.role}: ${s.finding}`)
      return exitFor(est)
    }

    case 'brief': {
      const query = positionals[0]
      if (!query) { console.error('brief needs a query.'); return 2 }
      const packages: PackageQuery[] = typeof flags.package === 'string'
        ? flags.package.split(',').map((n) => ({ name: n.trim(), ecosystem: 'npm' as const }))
        : []
      const brief = await voyagerRetrieve(query, {
        packages,
        discover: typeof flags.discover === 'string' ? flags.discover : undefined,
        search: typeof flags.search === 'string' ? flags.search : undefined,
        docs: typeof flags.docs === 'string' ? flags.docs : undefined,
        docsTopic: typeof flags.topic === 'string' ? flags.topic : undefined,
        proveInTwin: twin,
      })
      printBrief(brief.rendered, json, brief)
      return briefExit(brief)
    }

    case 'discover': {
      const q = positionals[0]
      if (!q) { console.error('discover needs an intent query.'); return 2 }
      const brief = await voyagerRetrieve(q, { discover: q })
      printBrief(brief.rendered, json, brief)
      return briefExit(brief)
    }

    case 'search': {
      const q = positionals[0]
      if (!q) { console.error('search needs a query.'); return 2 }
      const brief = await voyagerRetrieve(q, { search: q })
      printBrief(brief.rendered, json, brief)
      return briefExit(brief)
    }

    case 'docs': {
      const lib = positionals[0]
      if (!lib) { console.error('docs needs a library name.'); return 2 }
      // --doc-url makes the clean-fetch fallback reachable (allowlisted official
      // hosts only); without it, the fallback the code advertises cannot run.
      const brief = await voyagerRetrieve(lib, { docs: lib, docsTopic: typeof flags.topic === 'string' ? flags.topic : undefined, docUrl: typeof flags['doc-url'] === 'string' ? flags['doc-url'] : undefined })
      printBrief(brief.rendered, json, brief)
      return briefExit(brief)
    }

    case 'doctor': {
      console.log('voyager doctor')
      console.log('  Tier-A (zero-key): github (unauth, rate-limited), npm, pypi, osv — always available')
      const providers: KeyProvider[] = ['github', 'tavily', 'exa', 'apify', 'context7']
      for (const p of providers) {
        const k = await resolveVoyagerKey(p)
        console.log(`  ${p.padEnd(9)}: ${k ? 'key configured' : 'no key (source no-ops)'}`)
      }
      console.log(`  twin (npm install probe): ${process.env.VOYAGER_TWIN === '1' ? 'ENABLED' : 'off (set VOYAGER_TWIN=1 on a trusted machine)'}`)
      return 0
    }

    case 'mcp': {
      const { startMcpServer } = await import('./mcp.js')
      await startMcpServer()
      return new Promise<number>(() => {})
    }

    default:
      console.error(`Unknown command: ${cmd}\n`)
      console.log(HELP)
      return 2
  }
}

// Set exitCode and let Node drain streams/handles on its own. Forcing
// process.exit() right after async HTTP crashes libuv on Windows + Node 24
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err))
    // An unexpected throw is a TOOL failure, not a package rejection → exit 2.
    process.exitCode = 2
  })
