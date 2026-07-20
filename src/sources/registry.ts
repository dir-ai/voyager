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
  /** True when the registry publishes a build-provenance attestation for this
   *  version (npm SLSA provenance) — a strong, verifiable supply-chain signal. */
  hasProvenance: boolean
  /** True when this version declares ANY install/lifecycle script (preinstall,
   *  install, postinstall, prepare). npm's #1 malware vector — and the twin proof
   *  installs with --ignore-scripts, so these are NEVER executed or vetted. The
   *  gate must therefore refuse to certify such a package as a twin-proved FACT. */
  hasInstallScripts: boolean
  /** The declared install/lifecycle-script COMMAND strings (keyed by hook), for the
   *  gate's disclosure + static danger scan. Inline commands only (from the
   *  packument); the referenced script files are not fetched. {} when none. */
  installScripts: Record<string, string>
  /** Subresource integrity of the tarball that WOULD be installed (dist.integrity). */
  integrity: string | null
  provenance: VoyagerProvenance
}

/** The lifecycle hooks that run during `npm install` (the RCE surface). */
const INSTALL_LIFECYCLE_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare'] as const

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
  // Lifecycle scripts (preinstall/install/postinstall/prepare run on `npm install`).
  // The packument exposes these inline command strings per version, for free.
  scripts?: Record<string, unknown>
  dist?: {
    integrity?: string
    // Present when the publisher attached a build-provenance attestation.
    attestations?: { url?: string; provenance?: { predicateType?: string } }
  }
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
    yanked?: boolean
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

  // Install/lifecycle scripts — npm's #1 malware vector, exposed inline by the
  // packument. Capture the non-empty command strings for the gate's disclosure +
  // danger scan. Bounded (500 chars/hook) so a hostile giant string can't bloat.
  const rawScripts = manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {}
  const installScripts: Record<string, string> = {}
  for (const hook of INSTALL_LIFECYCLE_HOOKS) {
    const cmd = (rawScripts as Record<string, unknown>)[hook]
    if (typeof cmd === 'string' && cmd.trim()) installScripts[hook] = cmd.slice(0, 500)
  }
  const hasInstallScripts = Object.keys(installScripts).length > 0

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
    // `deprecated` is package-author-controlled and may be a boolean/object, not a
    // string — coerce so a downstream `.slice()` can never throw (DoS the brief).
    deprecated: typeof manifest.deprecated === 'string' ? manifest.deprecated : manifest.deprecated ? 'deprecated' : null,
    lastPublished,
    firstPublished,
    peerDependencies: manifest.peerDependencies ?? {},
    hasProvenance: Boolean(manifest.dist?.attestations?.provenance),
    hasInstallScripts,
    installScripts,
    integrity: manifest.dist?.integrity ?? null,
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
    // A release can be YANKED with no reason string — read the boolean too, or a
    // broken/insecure yanked version reads as non-deprecated and gets recommended.
    deprecated: info.yanked ? (typeof info.yanked_reason === 'string' && info.yanked_reason ? info.yanked_reason : 'yanked release') : null,
    lastPublished,
    firstPublished,
    peerDependencies: {},
    // PyPI attestations (PEP 740) are not read yet — treated as unsigned for now.
    hasProvenance: false,
    // PyPI install-hook detection (setup.py / build backends) is roadmap; the npm
    // lifecycle-script vector this guards does not apply to the JSON API here.
    hasInstallScripts: false,
    installScripts: {},
    integrity: null,
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
