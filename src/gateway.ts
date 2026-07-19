// Voyager Gateway — the ONE layer every source call passes through. The cascade
// talks to voyagerRetrieve(); voyagerRetrieve talks to the sources THROUGH the
// gateway. This is where per-source policy lives so it's enforced uniformly:
//   - a single SOURCE REGISTRY (id, tier, host, rate budget)
//   - per-source RATE LIMITING (min interval between calls — be a good citizen,
//     avoid bans / 429s) via an in-memory, process-local clock
//   - egress is already enforced one level down in http.ts; the registry's host
//     field documents (and lets us assert) which host a source may touch.
//
// Future tiers plug in here without touching callers: Tier-B doc consumers,
// MCP-discovery + verify-before-wire (F4), and PSX-produced MCP all register as
// sources and inherit the same policy. Server-side only.

import { isEgressAllowed } from './config.js'
import type { VoyagerTier } from './types.js'

export interface VoyagerSourceSpec {
  id: string
  tier: VoyagerTier
  /** The single host this source is allowed to reach (must be on the allowlist). */
  host: string
  /** Minimum ms between two calls to this source (simple rate budget). */
  minIntervalMs: number
}

/** The registered sources. Adding a tier = adding a row here. */
export const VOYAGER_SOURCES: Record<string, VoyagerSourceSpec> = {
  github: { id: 'github', tier: 'A', host: 'api.github.com', minIntervalMs: 800 },
  npm: { id: 'npm', tier: 'A', host: 'registry.npmjs.org', minIntervalMs: 150 },
  pypi: { id: 'pypi', tier: 'A', host: 'pypi.org', minIntervalMs: 150 },
  osv: { id: 'osv', tier: 'A', host: 'api.osv.dev', minIntervalMs: 150 },
  tavily: { id: 'tavily', tier: 'C', host: 'api.tavily.com', minIntervalMs: 1000 },
  exa: { id: 'exa', tier: 'C', host: 'api.exa.ai', minIntervalMs: 1000 },
  apify: { id: 'apify', tier: 'C', host: 'api.apify.com', minIntervalMs: 1500 },
  context7: { id: 'context7', tier: 'B', host: 'context7.com', minIntervalMs: 500 },
  // Tier-B clean-fetch fallback: host VARIES per doc (any host on the curated
  // VOYAGER_DOC_ALLOWLIST). Empty host → the per-call egress check in http.ts
  // governs which host is allowed; the gateway only applies the rate budget.
  docs: { id: 'docs', tier: 'B', host: '', minIntervalMs: 400 },
}

// Process-local last-call clock + a per-source serialization chain. In-memory is
// the right scope: rate budgets are per-process and reset on restart.
const lastCallAt = new Map<string, number>()
const gateChain = new Map<string, Promise<void>>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Acquire a rate-limit slot for a source. Successive acquisitions for the SAME
 * source are serialized (a promise chain), so two concurrent callers can't both
 * read the same lastCallAt and fire together — the reason the previous
 * read-compute-sleep-set version raced under concurrency. Only the spacing is
 * serialized; the caller's fetch runs concurrently afterward.
 */
async function acquireSlot(sourceId: string, minIntervalMs: number): Promise<void> {
  const prev = gateChain.get(sourceId) ?? Promise.resolve()
  const mine = prev.then(async () => {
    const wait = minIntervalMs - (Date.now() - (lastCallAt.get(sourceId) ?? 0))
    if (wait > 0) await sleep(wait)
    lastCallAt.set(sourceId, Date.now())
  })
  gateChain.set(sourceId, mine.catch(() => {}))
  await mine
}

/**
 * Run a source call through the gateway: assert the source's host is on the
 * egress allowlist, apply its rate budget, then invoke `fn`. Unknown source ids
 * pass through ungoverned (so ad-hoc calls still work) but that's discouraged.
 */
export async function withGateway<T>(sourceId: string, fn: () => Promise<T>): Promise<T> {
  const spec = VOYAGER_SOURCES[sourceId]
  if (spec) {
    // Defense in depth: a registered source with a FIXED host must point at an
    // allowlisted host. A varying-host source (host: '') defers the check to the
    // per-call egress guard in http.ts.
    if (spec.host && !isEgressAllowed(spec.host)) {
      throw new Error(`voyager gateway: source "${sourceId}" host ${spec.host} not on the allowlist`)
    }
    await acquireSlot(sourceId, spec.minIntervalMs)
  }
  return fn()
}

/** Test/diagnostic helper — reset the rate clock (used by smoke). */
export function __resetGatewayClock(): void {
  lastCallAt.clear()
  gateChain.clear()
}
