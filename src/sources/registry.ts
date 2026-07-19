// Voyager Tier-A source — package registries (npm + PyPI). Structured facts:
// latest version, license, deprecation, homepage, maintenance signal. No
// scraping, no key. The "is this a real, maintained package?" ground truth that
// precedes (and is combined with) the OSV gate and the twin probe.

import { voyagerFetchJson } from '../http.js'
import { withGateway } from '../gateway.js'
import type { PackageQuery, VoyagerProvenance } from '../types.js'

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
  provenance: VoyagerProvenance
}

// npm/PyPI package name shape — reject anything that could build an odd URL.
const VALID_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i

// Per-VERSION manifest (`/pkg/<version|latest>`) — a few KB even for typescript
// (whose FULL packument is ~15MB). Carries everything the verdict needs.
interface NpmManifest {
  version?: string
  description?: string
  license?: string | { type?: string }
  homepage?: string
  deprecated?: string
  peerDependencies?: Record<string, string>
}

// Full packument — only fetched best-effort for the `time` map (age signals).
interface NpmPackument {
  time?: Record<string, string>
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
  // Present on the per-version endpoint (/pypi/{name}/{version}/json): the files
  // for that specific version, carrying its upload time.
  urls?: Array<{ upload_time_iso_8601?: string }>
}

async function npmFacts(pkg: PackageQuery): Promise<PackageFacts> {
  const name = pkg.name
  const ref = pkg.version ?? 'latest'
  // (1) Per-version manifest — the authoritative core facts. Tiny (KBs), so the
  //     byte cap never trips it: this is what unblocked `check typescript/react`,
  //     whose FULL packuments are 15MB/6.8MB and were being REJECTED as "registry
  //     unreachable". A 404 here means the (version of the) package doesn't exist.
  const manifest = await withGateway('npm', () =>
    voyagerFetchJson<NpmManifest>(`https://registry.npmjs.org/${name}/${encodeURIComponent(ref)}`, {
      cacheTtlMs: 600_000,
      maxBytes: 3_000_000,
    }),
  )
  const version = manifest.version ?? null
  const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type ?? null

  // (2) Age signals live only in the full packument's `time` map — fetch it
  //     BEST-EFFORT. A huge packument trips the byte cap; we degrade to null age
  //     rather than failing the check. That is safe because the age<30d
  //     supply-chain flag matters for NEW packages, whose packuments are small
  //     and fetch fine — the giants that overflow are famously old anyway.
  const enc = name.startsWith('@') ? name.replace('/', '%2f') : name
  let firstPublished: string | null = null
  let lastPublished: string | null = null
  try {
    const pack = await withGateway('npm', () =>
      voyagerFetchJson<NpmPackument>(`https://registry.npmjs.org/${enc}`, { cacheTtlMs: 600_000, maxBytes: 6_000_000 }),
    )
    firstPublished = pack.time?.created ?? null
    lastPublished = pack.time?.modified ?? (version ? pack.time?.[version] ?? null : null) ?? null
  } catch {
    /* packument too large / transient — age signals unavailable, not a failure */
  }

  return {
    name,
    ecosystem: 'npm',
    latestVersion: version,
    license,
    description: manifest.description ?? null,
    homepage: manifest.homepage ?? null,
    deprecated: manifest.deprecated ?? null,
    lastPublished,
    firstPublished,
    peerDependencies: manifest.peerDependencies ?? {},
    provenance: {
      source: 'npm registry',
      tier: 'A',
      url: `https://www.npmjs.com/package/${name}`,
      fetchedAt: new Date().toISOString(),
    },
  }
}

async function pypiFacts(pkg: PackageQuery): Promise<PackageFacts> {
  // PEP 503: PyPI project names are case-insensitive and treat runs of -, _, .
  // as equivalent. Normalize for the URL so `Requests`, `requests` and
  // `re-quests` resolve to the same project.
  const norm = pkg.name.toLowerCase().replace(/[-_.]+/g, '-')
  // Honor the requested version: hit the per-version endpoint so the facts
  // describe the SAME subject OSV is asked about (not always latest). Previously
  // this ignored pkg.version and returned latest → the verdict mixed two versions.
  const url = pkg.version
    ? `https://pypi.org/pypi/${encodeURIComponent(norm)}/${encodeURIComponent(pkg.version)}/json`
    : `https://pypi.org/pypi/${encodeURIComponent(norm)}/json`
  const json = await withGateway('pypi', () => voyagerFetchJson<PypiResponse>(url, { cacheTtlMs: 600_000, maxBytes: 5_000_000 }))
  const info = json.info ?? {}
  const version = pkg.version ?? info.version ?? null
  const lastPublished =
    json.urls?.[0]?.upload_time_iso_8601 ??
    (version ? json.releases?.[version]?.[0]?.upload_time_iso_8601 ?? null : null)
  // Earliest upload across all releases — PyPI has no single "created" field.
  const allTimes = Object.values(json.releases ?? {}).flatMap((rs) => rs.map((r) => r.upload_time_iso_8601)).filter(Boolean) as string[]
  const firstPublished = allTimes.length ? allTimes.sort()[0] : null
  const homepage = info.home_page || info.project_urls?.Homepage || null
  return {
    name: pkg.name,
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
      url: `https://pypi.org/project/${norm}/`,
      fetchedAt: new Date().toISOString(),
    },
  }
}

/** Fetch structured registry facts for a package. Throws on transport failure. */
export async function packageFacts(pkg: PackageQuery): Promise<PackageFacts> {
  if (!VALID_PACKAGE_NAME.test(pkg.name)) {
    throw new Error(`invalid package name: ${pkg.name}`)
  }
  return pkg.ecosystem === 'pypi' ? pypiFacts(pkg) : npmFacts(pkg)
}
