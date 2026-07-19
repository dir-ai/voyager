#!/usr/bin/env node
/**
 * voyager MCP server (stdio). Gives an agent a verified, cited, OSV-gated,
 * injection-hardened brief instead of a raw web response — and a package safety
 * check before it recommends a dependency.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { voyagerRetrieve } from './index.js'
import { establishPackage } from './establish.js'
import type { PackageQuery } from './types.js'
import { VERSION } from './version.js'

const server = new Server({ name: 'voyager', version: VERSION }, { capabilities: { tools: {} } })

// Strict, closed schemas: additionalProperties:false + explicit bounds so a
// client can't smuggle unexpected fields and a runaway string/array can't bloat
// the request. The runtime handler validates again (the SDK advertises the
// schema but does not enforce it).
const PACKAGE_QUERY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 214 },
    ecosystem: { type: 'string', enum: ['npm', 'pypi'] },
    version: { type: 'string', maxLength: 64 },
  },
  required: ['name'],
} as const

const TOOLS = [
  {
    name: 'check_package',
    description:
      'Verify a package before recommending it: registry facts + OSV vulnerability gate (fail-closed) + provenance/license/age supply-chain signals, optionally reproduced in an ISOLATED (container) twin. Returns an adversarial verdict (fact/belief/rejected) with the full trace. isError:true means the verdict could NOT be computed (tool/registry failure), NOT that the package is unsafe.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 214 },
        ecosystem: { type: 'string', enum: ['npm', 'pypi'] },
        version: { type: 'string', maxLength: 64, description: 'Optional pinned version (default: latest).' },
        proveInTwin: { type: 'boolean', description: 'Install + smoke-import in an isolated container to promote belief→reproduced (trusted machines only).' },
        projectDeps: { type: 'object', additionalProperties: { type: 'string' }, description: 'name → range: peer-compat check against your stack.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'retrieve',
    description:
      'Turn a query into a cited, confidence-scored, injection-hardened BRIEF (the only surface you should feed a model). Combine package verification, GitHub discovery, canonical docs, and open-web search — each cross-referenced. Returns the rendered brief + structured claims.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 2000 },
        packages: { type: 'array', items: PACKAGE_QUERY, maxItems: 20, description: 'PackageQuery[] to verify.' },
        discover: { type: 'string', maxLength: 500, description: 'Free-text intent → GitHub repo discovery.' },
        search: { type: 'string', maxLength: 500, description: 'Open-web search (Tier-C, needs a provider key).' },
        docs: { type: 'string', maxLength: 214, description: 'Library/topic → canonical docs (Tier-B).' },
        docsTopic: { type: 'string', maxLength: 200 },
        proveInTwin: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'discover_repos',
    description: 'GitHub repo discovery for an intent (Tier-A): cited hits with stars, archived flag, confidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: { type: 'string', minLength: 1, maxLength: 500 },
        limit: { type: 'integer', minimum: 1, maximum: 25 },
      },
      required: ['intent'],
    },
  },
  {
    name: 'fetch_docs',
    description: 'Canonical docs for a library (Tier-B, official hosts only), injection-stripped and framed as evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        library: { type: 'string', minLength: 1, maxLength: 214 },
        topic: { type: 'string', maxLength: 200 },
        docUrl: { type: 'string', maxLength: 512, description: 'An official-docs URL (allowlisted hosts only) — enables the clean-fetch fallback when Context7 has no key/hit.' },
      },
      required: ['library'],
    },
  },
] as const

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params
  // `isError` carries the SEMANTIC failure signal: for check_package it is true
  // only when the verdict could not be computed (Establishment.error), never for
  // a package that was simply rejected as unsafe (that is a valid result).
  const result = (data: unknown, isError = false) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], ...(isError ? { isError: true } : {}) })
  const ok = (data: unknown) => result(data)
  const err = (message: string) => result({ error: message }, true)
  // STRICT validation: an over-long or wrong-typed field is REJECTED, never
  // silently truncated/coerced — truncation would make Voyager verify a
  // different subject than the one the client asked about.
  class McpInputError extends Error {}
  const str = (v: unknown, max: number, field: string): string | undefined => {
    if (v === undefined || v === null) return undefined
    if (typeof v !== 'string') throw new McpInputError(`${field} must be a string`)
    if (v.length === 0) return undefined
    if (v.length > max) throw new McpInputError(`${field} exceeds ${max} chars — rejected (not truncated)`)
    return v
  }
  const ecoOf = (v: unknown): 'npm' | 'pypi' => {
    if (v === undefined || v === 'npm') return 'npm'
    if (v === 'pypi') return 'pypi'
    throw new McpInputError(`ecosystem must be "npm" or "pypi", got ${JSON.stringify(v)}`)
  }

  try {
    if (name === 'check_package') {
      const a = args as { name?: unknown; ecosystem?: unknown; version?: unknown; proveInTwin?: unknown; projectDeps?: unknown }
      const pkgName = str(a.name, 214, 'name')
      if (!pkgName) return err('name required')
      const pkg: PackageQuery = { name: pkgName, ecosystem: ecoOf(a.ecosystem), version: str(a.version, 64, 'version') }
      const projectDeps = a.projectDeps && typeof a.projectDeps === 'object' ? (a.projectDeps as Record<string, string>) : undefined
      const est = await establishPackage(pkg, { proveInTwin: a.proveInTwin === true, projectDeps })
      // A tool/registry failure → isError; a "rejected" (unsafe) package is a
      // legitimate, successful verdict and stays isError:false.
      return result(est, Boolean(est.error))
    }
    if (name === 'retrieve') {
      const a = args as { query?: unknown; packages?: unknown; discover?: unknown; search?: unknown; docs?: unknown; docsTopic?: unknown; proveInTwin?: unknown }
      const query = str(a.query, 2000, 'query')
      if (!query) return err('query required')
      // Validate every PackageQuery item strictly — reject a malformed list.
      let packages: PackageQuery[] | undefined
      if (a.packages !== undefined) {
        if (!Array.isArray(a.packages) || a.packages.length > 20) throw new McpInputError('packages must be an array of at most 20 items')
        packages = a.packages.map((p, i) => {
          const q = p as { name?: unknown; ecosystem?: unknown; version?: unknown }
          const n = str(q?.name, 214, `packages[${i}].name`)
          if (!n) throw new McpInputError(`packages[${i}].name required`)
          return { name: n, ecosystem: ecoOf(q.ecosystem), version: str(q.version, 64, `packages[${i}].version`) }
        })
      }
      return ok(await voyagerRetrieve(query, {
        packages,
        discover: str(a.discover, 500, 'discover'),
        search: str(a.search, 500, 'search'),
        docs: str(a.docs, 214, 'docs'),
        docsTopic: str(a.docsTopic, 200, 'docsTopic'),
        proveInTwin: a.proveInTwin === true,
      }))
    }
    if (name === 'discover_repos') {
      const a = args as { intent?: unknown; limit?: unknown }
      const intent = str(a.intent, 500, 'intent')
      if (!intent) return err('intent required')
      let limit: number | undefined
      if (a.limit !== undefined) {
        if (typeof a.limit !== 'number' || !Number.isInteger(a.limit) || a.limit < 1 || a.limit > 25) {
          throw new McpInputError('limit must be an integer between 1 and 25')
        }
        limit = a.limit
      }
      return ok(await voyagerRetrieve(intent, { discover: intent, discoverLimit: limit }))
    }
    if (name === 'fetch_docs') {
      const a = args as { library?: unknown; topic?: unknown; docUrl?: unknown }
      const library = str(a.library, 214, 'library')
      if (!library) return err('library required')
      return ok(await voyagerRetrieve(library, { docs: library, docsTopic: str(a.topic, 200, 'topic'), docUrl: str(a.docUrl, 512, 'docUrl') || undefined }))
    }
    return err(`Unknown tool: ${name}`)
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
})

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`voyager MCP server v${VERSION} ready (stdio)`)
}

import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
function isDirectEntry(): boolean {
  const argv1 = process.argv[1]
  if (!argv1) return false
  const self = fileURLToPath(import.meta.url)
  try { return realpathSync(self) === realpathSync(argv1) } catch { return self === argv1 }
}
if (isDirectEntry()) {
  startMcpServer().catch((e) => { console.error(e instanceof Error ? e.stack : String(e)); process.exit(1) })
}
