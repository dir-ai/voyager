// Provenator Tier-A source — package registries (npm + PyPI). Structured facts:
// latest version, license, deprecation, homepage, maintenance signal. No
// scraping, no key. The "is this a real, maintained package?" ground truth that
// precedes (and is combined with) the OSV gate and the twin probe.

import { provenatorFetchJson } from '../http.js'
import { withGateway } from '../gateway.js'
import type { PackageQuery, ProvenatorProvenance } from '../types.js'

export interface PackageFacts {
  name: string
  ecosystem: PackageQuery['ecosystem']
  /** Resolved latest version (the one a probe would install if none pinned). */
  latestVersion: string | null
  license: string | null
  description: string | null
  homepage: string | null
  /** Registry-reported deprecation message, if any. A strong negative signal. */
  deprecated: string | null
  /** ISO timestamp of the most recent release — a maintenance signal. */
  lastPublished: string | null
  /** ISO timestamp the package was FIRST published — a supply-chain age signal
   *  (a brand-new package is higher risk). Null when the registry omits it. */
  firstPublished: string | null
  /** Peer deps of the latest version (npm) — input to the compat check. {} for PyPI. */
  peerDependencies: Record<string, string>
  provenance: ProvenatorProvenance
}

// npm/PyPI package name shape — reject anything that could build an odd URL.
const VALID_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i

interface NpmPackument {
  'dist-tags'?: { latest?: string }
  description?: string
  license?: string | { type?: string }
  homepage?: string
  time?: Record<string, string>
  versions?: Record<string, { deprecated?: string; peerDependencies?: Record<string, string> }>
}

interface PypiResponse {
  info?: {
    version?: string
    summary?: string
    license?: string
    home_page?: string
    project_urls?: Record<string, string> | null
    yanked_reason?: string | null
  }
  releases?: Record<string, Array<{ upload_time_iso_8601?: string; yanked?: boolean }>>
}

async function npmFacts(name: string): Promise<PackageFacts> {
  // Encode a scoped name's slash for the registry path.
  const path = name.startsWith('@') ? name.replace('/', '%2f') : name
  const json = await withGateway('npm', () => provenatorFetchJson<NpmPackument>(`https://registry.npmjs.org/${path}`, { cacheTtlMs: 600_000, maxBytes: 5_000_000 }))
  const latest = json['dist-tags']?.latest ?? null
  const license = typeof json.license === 'string' ? json.license : json.license?.type ?? null
  const deprecated = latest ? json.versions?.[latest]?.deprecated ?? null : null
  const peerDependencies = (latest ? json.versions?.[latest]?.peerDependencies : null) ?? {}
  const lastPublished = json.time?.modified ?? (latest ? json.time?.[latest] : null) ?? null
  return {
    name,
    ecosystem: 'npm',
    latestVersion: latest,
    license,
    description: json.description ?? null,
    homepage: json.homepage ?? null,
    deprecated: deprecated ?? null,
    lastPublished,
    firstPublished: json.time?.created ?? null,
    peerDependencies,
    provenance: {
      source: 'npm registry',
      tier: 'A',
      url: `https://www.npmjs.com/package/${name}`,
      fetchedAt: new Date().toISOString(),
    },
  }
}

async function pypiFacts(name: string): Promise<PackageFacts> {
  const json = await withGateway('pypi', () => provenatorFetchJson<PypiResponse>(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { cacheTtlMs: 600_000, maxBytes: 5_000_000 }))
  const info = json.info ?? {}
  const version = info.version ?? null
  const lastPublished = version
    ? json.releases?.[version]?.[0]?.upload_time_iso_8601 ?? null
    : null
  // Earliest upload across all releases — PyPI has no single "created" field.
  const allTimes = Object.values(json.releases ?? {}).flatMap((rs) => rs.map((r) => r.upload_time_iso_8601)).filter(Boolean) as string[]
  const firstPublished = allTimes.length ? allTimes.sort()[0] : null
  const homepage = info.home_page || info.project_urls?.Homepage || null
  return {
    name,
    ecosystem: 'pypi',
    latestVersion: version,
    license: info.license ?? null,
    description: info.summary ?? null,
    homepage,
    deprecated: info.yanked_reason ?? null,
    lastPublished,
    firstPublished,
    peerDependencies: {},
    provenance: {
      source: 'PyPI',
      tier: 'A',
      url: `https://pypi.org/project/${name}/`,
      fetchedAt: new Date().toISOString(),
    },
  }
}

/** Fetch structured registry facts for a package. Throws on transport failure. */
export async function packageFacts(pkg: PackageQuery): Promise<PackageFacts> {
  if (!VALID_PACKAGE_NAME.test(pkg.name)) {
    throw new Error(`invalid package name: ${pkg.name}`)
  }
  return pkg.ecosystem === 'pypi' ? pypiFacts(pkg.name) : npmFacts(pkg.name)
}
