// Provenator — shared types. The unit of Provenator output is a CLAIM: a single
// assertion about the outside world, carrying its provenance and a calibrated
// confidence. A bundle of claims for one query is a BRIEF — the only thing the
// cascade/coder ever sees (never a raw web response, never a raw MCP server).
//
// See docs/PSX_PROVENATOR_ARCHITECTURE.md.

/** Source Registry tier — drives the trust threshold at the Verify Gate. */
export type ProvenatorTier = 'A' | 'B' | 'C' | 'D'

/** Epistemic state of a claim. A fact carries a runnable proof executed in the
 *  twin; a belief is asserted by a source but not (yet) reproduced. */
export type ProvenatorEpistemic = 'fact' | 'belief'

/** Where a claim came from — no anonymous facts. */
export interface ProvenatorProvenance {
  /** Human-readable source label, e.g. "GitHub API", "OSV.dev", "npm registry". */
  source: string
  tier: ProvenatorTier
  /** Canonical URL the claim can be traced to (no key, no PII). */
  url?: string
  /** ISO timestamp the source was fetched (freshness — pillar 4 hooks here). */
  fetchedAt: string
}

/** A single verified-or-believed assertion about the world. */
export interface ProvenatorClaim {
  /** The assertion, as a short factual statement. */
  statement: string
  epistemic: ProvenatorEpistemic
  /** Calibrated 0..1 — "99% verified in your twin" vs "40% single blog". */
  confidence: number
  provenance: ProvenatorProvenance[]
  /** Structured payload (package metadata, vuln list, repo hits) for the caller. */
  data?: Record<string, unknown>
  /** Set when the OSV gate or a twin-probe blocked/flagged this claim. */
  warning?: string
}

/** The verified, cited bundle for one query — Provenator's only output surface. */
export interface ProvenatorBrief {
  query: string
  claims: ProvenatorClaim[]
  /** True if at least one claim cleared the gate. */
  ok: boolean
  /** Non-fatal notes (a source was unreachable, a key was missing, etc.). */
  notes: string[]
  /** Rendered, injection-stripped text block for prompt augmentation. */
  rendered: string
}

/** A package-suitability question — the F0 specialty (lib/api recommendation). */
export interface PackageQuery {
  /** Package name as it appears in the registry. */
  name: string
  /** Ecosystem registry. */
  ecosystem: 'npm' | 'pypi'
  /** Optional pinned version to probe; omit to use the latest. */
  version?: string
}
