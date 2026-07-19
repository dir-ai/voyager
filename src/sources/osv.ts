// Voyager Tier-A source — OSV.dev vulnerability database.
// SECURITY-FIRST: this is the gate every package recommendation must pass. OSV
// is queried BEFORE a package is ever suggested (retrieval policy §5.4). Public
// API, no key required. https://google.github.io/osv.dev/post-v1-query/

import { voyagerFetchJson } from '../http.js'
import { withGateway } from '../gateway.js'
import type { PackageQuery, VoyagerProvenance } from '../types.js'

const OSV_QUERY_URL = 'https://api.osv.dev/v1/query'

/** OSV ecosystem name for our PackageQuery ecosystem. */
function osvEcosystem(eco: PackageQuery['ecosystem']): string {
  return eco === 'pypi' ? 'PyPI' : 'npm'
}

export interface OsvVuln {
  id: string
  summary: string
  /** Severity label if OSV provides one (CVSS vector omitted for brevity). */
  severity?: string
  /** Advisory URL for provenance. */
  reference?: string
}

export interface OsvResult {
  /** True if OSV returned zero vulns for this package@version. */
  clean: boolean
  vulns: OsvVuln[]
  provenance: VoyagerProvenance
}

interface OsvApiVuln {
  id?: string
  summary?: string
  details?: string
  severity?: Array<{ type?: string; score?: string }>
  references?: Array<{ type?: string; url?: string }>
}

/**
 * Check a package (optionally pinned to a version) against OSV. A missing
 * version queries the package across all versions. Throws on egress/transport
 * failure — the caller decides whether a failed check blocks a suggestion.
 */
export async function osvCheck(pkg: PackageQuery): Promise<OsvResult> {
  const body = {
    package: { name: pkg.name, ecosystem: osvEcosystem(pkg.ecosystem) },
    ...(pkg.version ? { version: pkg.version } : {}),
  }
  const json = await withGateway('osv', () =>
    voyagerFetchJson<{ vulns?: OsvApiVuln[] }>(OSV_QUERY_URL, { method: 'POST', body, cacheTtlMs: 600_000 }),
  )

  const vulns: OsvVuln[] = (json.vulns ?? []).map((v) => ({
    id: v.id ?? 'UNKNOWN',
    summary: (v.summary ?? v.details ?? '').slice(0, 240),
    severity: v.severity?.[0]?.score,
    reference: v.references?.find((r) => r.type === 'ADVISORY')?.url ?? v.references?.[0]?.url,
  }))

  return {
    clean: vulns.length === 0,
    vulns,
    provenance: {
      source: 'OSV.dev',
      tier: 'A',
      url: `https://osv.dev/list?q=${encodeURIComponent(pkg.name)}&ecosystem=${osvEcosystem(pkg.ecosystem)}`,
      fetchedAt: new Date().toISOString(),
    },
  }
}
