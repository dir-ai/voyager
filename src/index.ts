// voyager — public entrypoint. Turns a query into a verified, cited,
// confidence-scored BRIEF: the only surface a model should ever see. Never a raw
// web response. Server-side only.
//
// Tiers: A = structured facts (GitHub / npm / PyPI / OSV), B = canonical docs,
// C = open-web search (cross-referenced before it's trusted), D = a twin proof.

import { voyagerEnabled } from './config.js'
import { githubRepoSearch } from './sources/github.js'
import { tavilySearch } from './sources/tavily.js'
import { exaSearch } from './sources/exa.js'
import { apifySearch } from './sources/apify.js'
import { context7Docs } from './sources/context7.js'
import { fetchDocUrl } from './sources/docs.js'
import { establishPackage } from './establish.js'
import { crossReferenceClaims } from './cross-reference.js'
import { asUntrustedEvidence } from './http.js'
import type { PackageQuery, VoyagerBrief, VoyagerClaim } from './types.js'

export type { VoyagerBrief, VoyagerClaim, PackageQuery, VoyagerTier, VoyagerEpistemic, VoyagerProvenance } from './types.js'
export { setKeyResolver, type KeyResolver, type KeyProvider } from './keys.js'
export { establishPackage, type Establishment } from './establish.js'
export { gatePackage, calibrateConfidence, type PackageVerdict } from './gate.js'
export { VOYAGER_EGRESS_ALLOWLIST, VOYAGER_DOC_ALLOWLIST, voyagerEnabled } from './config.js'
export { asUntrustedEvidence, stripInjection, assertEgressAllowed, VoyagerEgressError } from './http.js'
export { VERSION } from './version.js'

/** Convenience: verify a single package (OSV gate + registry facts + optional
 *  twin), returning its establishment verdict. A thin wrapper over establishPackage. */
export async function checkPackage(
  pkg: PackageQuery,
  opts: { proveInTwin?: boolean; projectDeps?: Record<string, string> } = {},
): Promise<import('./establish.js').Establishment> {
  const { establishPackage } = await import('./establish.js')
  return establishPackage(pkg, opts)
}

export interface VoyagerRetrieveOptions {
  /** Packages to verify (with OSV gate + optional twin probe). */
  packages?: PackageQuery[]
  /** Free-text intent for a GitHub repo discovery pass. */
  discover?: string
  /** Open-web search query (Tier-C, low-trust, key-gated). The internet reach. */
  search?: string
  /** Canonical-docs query (Tier-B): a library/topic resolved via Context7. */
  docs?: string
  /** Optional topic to focus the Context7 docs fetch. */
  docsTopic?: string
  /** Explicit official-doc URL for the clean-fetch fallback (allowlist-gated). */
  docUrl?: string
  /** Run the digital-twin probe for packages (still gated by PSX_VOYAGER_TWIN). */
  proveInTwin?: boolean
  /** Project's declared deps (name → range) → peer-compat check on packages. */
  projectDeps?: Record<string, string>
  /** Max repo hits for the discovery pass. */
  discoverLimit?: number
  /** Max web-search results. */
  searchLimit?: number
}

function renderBrief(query: string, claims: VoyagerClaim[], notes: string[]): string {
  if (!claims.length) {
    return asUntrustedEvidence('Voyager brief (no claims)', `Query: ${query}\n${notes.join('\n')}`)
  }
  const lines = claims.map((c) => {
    const pct = Math.round(c.confidence * 100)
    const tag = c.epistemic === 'fact' ? 'FACT' : 'belief'
    const cite = c.provenance.map((p) => `${p.source}[${p.tier}]`).join(', ')
    const warn = c.warning ? `\n    ⚠ ${c.warning}` : ''
    return `- [${tag} · ${pct}%] ${c.statement}\n    src: ${cite}${warn}`
  })
  // The brief is itself framed as evidence: it is Voyager's vetted output, but
  // the underlying statements still originated outside — the model reasons over
  // them, it does not obey them.
  return asUntrustedEvidence(
    'Voyager verified brief',
    `Query: ${query}\n${lines.join('\n')}${notes.length ? `\n\nnotes: ${notes.join('; ')}` : ''}`,
  )
}

/**
 * Retrieve and verify. Always returns a brief (never throws) so the cascade can
 * degrade gracefully; transport failures land in `notes`. Returns an empty,
 * not-ok brief immediately when the master flag is off.
 */
export async function voyagerRetrieve(
  query: string,
  opts: VoyagerRetrieveOptions = {},
): Promise<VoyagerBrief> {
  const notes: string[] = []
  if (!voyagerEnabled()) {
    return {
      query,
      claims: [],
      ok: false,
      notes: ['voyager disabled (VOYAGER_OFF=1)'],
      rendered: 'voyager disabled (VOYAGER_OFF=1) — no retrieval performed. Unset VOYAGER_OFF to re-enable.',
    }
  }

  const claims: VoyagerClaim[] = []

  // ── Package establishment (adversarial: proposer → skeptic → judge) ──────────
  for (const pkg of opts.packages ?? []) {
    const est = await establishPackage(pkg, { proveInTwin: opts.proveInTwin, projectDeps: opts.projectDeps })
    if (est.claim) claims.push(est.claim)
    else notes.push(`package ${pkg.name} not established: ${est.steps[0]?.finding ?? 'error'}`)
  }

  // ── Discovery pass (GitHub repo search, Tier A) ─────────────────────────────
  if (opts.discover) {
    try {
      const res = await githubRepoSearch(opts.discover, opts.discoverLimit ?? 5)
      for (const hit of res.hits) {
        claims.push({
          statement: `${hit.fullName} — ★${hit.stars}${hit.archived ? ' (ARCHIVED)' : ''}${hit.description ? ` — ${hit.description.slice(0, 120)}` : ''}`,
          epistemic: 'belief',
          confidence: hit.archived ? 0.4 : 0.7,
          provenance: [res.provenance],
          data: { fullName: hit.fullName, stars: hit.stars, url: hit.url, pushedAt: hit.pushedAt, archived: hit.archived },
          ...(hit.archived ? { warning: 'archived repo — unmaintained' } : {}),
        })
      }
      if (!res.hits.length) notes.push(`no repos for "${opts.discover}"`)
    } catch (e) {
      notes.push(`discovery: ${(e as Error)?.message ?? 'error'}`)
    }
  }

  // ── Canonical docs (Tier B, authoritative): Context7 primary, clean-fetch
  // fallback on the curated official-doc allowlist. ────────────────────────────
  if (opts.docs || opts.docUrl) {
    let docClaims = 0
    if (opts.docs) {
      const c7 = await context7Docs(opts.docs, opts.docsTopic)
      claims.push(...c7.claims)
      docClaims += c7.claims.length
      if (c7.note) notes.push(c7.note)
    }
    // Fallback only when Context7 found nothing and an official URL is provided.
    if (docClaims === 0 && opts.docUrl) {
      const fallback = await fetchDocUrl(opts.docUrl)
      claims.push(...fallback.claims)
      if (fallback.note) notes.push(fallback.note)
    }
  }

  // ── Open-web search (Tier C, low-trust, cross-reference required) ────────────
  // Fan out across every configured Tier-C provider (Tavily search + Apify
  // actor). Each no-ops without its own Vault key, so a box with one key uses
  // one provider and a box with none stays silent — runtime unchanged when off.
  if (opts.search) {
    const [tav, exa, apf] = await Promise.all([
      tavilySearch(opts.search, opts.searchLimit ?? 5),
      exaSearch(opts.search, opts.searchLimit ?? 5),
      apifySearch(opts.search, Math.min(opts.searchLimit ?? 3, 5)),
    ])
    for (const outcome of [tav, exa, apf]) {
      claims.push(...outcome.claims)
      if (outcome.note) notes.push(outcome.note)
    }
  }

  // ── Cross-reference: confirm/contradict Tier-C web claims against the A/B
  // anchors (packages, repos) gathered above. Security/quality truth wins.
  const finalClaims = crossReferenceClaims(claims)

  return {
    query,
    claims: finalClaims,
    ok: finalClaims.length > 0,
    notes,
    rendered: renderBrief(query, finalClaims, notes),
  }
}
