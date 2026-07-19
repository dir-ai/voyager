#!/usr/bin/env node
/**
 * provenator MCP server (stdio). Gives an agent a verified, cited, OSV-gated,
 * injection-safe brief instead of a raw web response — and a package safety
 * check before it recommends a dependency.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { provenatorRetrieve } from './index.js'
import { establishPackage } from './establish.js'
import type { PackageQuery } from './types.js'
import { VERSION } from './version.js'

const server = new Server({ name: 'provenator', version: VERSION }, { capabilities: { tools: {} } })

const TOOLS = [
  {
    name: 'check_package',
    description:
      'Verify a package before recommending it: registry facts + OSV vulnerability gate (fail-closed) + license/age supply-chain signals, optionally reproduced in a disposable twin. Returns an adversarial verdict (fact/belief/rejected) with the full trace.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ecosystem: { type: 'string', enum: ['npm', 'pypi'] },
        version: { type: 'string', description: 'Optional pinned version (default: latest).' },
        proveInTwin: { type: 'boolean', description: 'Install+smoke in a sandbox to promote belief→fact (trusted machines only).' },
        projectDeps: { type: 'object', description: 'name → range: peer-compat check against your stack.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'retrieve',
    description:
      'Turn a query into a cited, confidence-scored, injection-safe BRIEF (the only surface you should feed a model). Combine package verification, GitHub discovery, canonical docs, and open-web search — each cross-referenced. Returns the rendered brief + structured claims.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        packages: { type: 'array', items: { type: 'object' }, description: 'PackageQuery[] to verify.' },
        discover: { type: 'string', description: 'Free-text intent → GitHub repo discovery.' },
        search: { type: 'string', description: 'Open-web search (Tier-C, needs a provider key).' },
        docs: { type: 'string', description: 'Library/topic → canonical docs (Tier-B).' },
        docsTopic: { type: 'string' },
        proveInTwin: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'discover_repos',
    description: 'GitHub repo discovery for an intent (Tier-A): cited hits with stars, archived flag, confidence.',
    inputSchema: { type: 'object', properties: { intent: { type: 'string' }, limit: { type: 'number' } }, required: ['intent'] },
  },
  {
    name: 'fetch_docs',
    description: 'Canonical docs for a library (Tier-B, official hosts only), injection-stripped and framed as evidence.',
    inputSchema: { type: 'object', properties: { library: { type: 'string' }, topic: { type: 'string' } }, required: ['library'] },
  },
] as const

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params
  const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] })
  const err = (message: string) => ({ content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true })

  try {
    if (name === 'check_package') {
      const a = args as { name?: string; ecosystem?: 'npm' | 'pypi'; version?: string; proveInTwin?: boolean; projectDeps?: Record<string, string> }
      if (!a.name) return err('name required')
      const pkg: PackageQuery = { name: a.name, ecosystem: a.ecosystem === 'pypi' ? 'pypi' : 'npm', version: a.version }
      return ok(await establishPackage(pkg, { proveInTwin: a.proveInTwin, projectDeps: a.projectDeps }))
    }
    if (name === 'retrieve') {
      const a = args as { query?: string; packages?: PackageQuery[]; discover?: string; search?: string; docs?: string; docsTopic?: string; proveInTwin?: boolean }
      if (!a.query) return err('query required')
      return ok(await provenatorRetrieve(a.query, {
        packages: a.packages, discover: a.discover, search: a.search, docs: a.docs, docsTopic: a.docsTopic, proveInTwin: a.proveInTwin,
      }))
    }
    if (name === 'discover_repos') {
      const a = args as { intent?: string; limit?: number }
      if (!a.intent) return err('intent required')
      return ok(await provenatorRetrieve(a.intent, { discover: a.intent, discoverLimit: a.limit }))
    }
    if (name === 'fetch_docs') {
      const a = args as { library?: string; topic?: string }
      if (!a.library) return err('library required')
      return ok(await provenatorRetrieve(a.library, { docs: a.library, docsTopic: a.topic }))
    }
    return err(`Unknown tool: ${name}`)
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
})

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`provenator MCP server v${VERSION} ready (stdio)`)
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
