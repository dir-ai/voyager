// Voyager — automated cross-reference. Retrieval policy §5.3: a Tier-C (open-web,
// low-trust) claim must be CONFIRMED by an A/B source before it's trusted. Here
// we do it deterministically: when a web claim names a package/repo that Voyager
// ALSO verified through a Tier-A source, the web claim is corroborated.
//
//  - POSITIVE anchor (exists, OSV-clean, not deprecated) → upgrade the web claim
//    (raise confidence into the "cross-referenced" band, swap the "unconfirmed"
//    warning for the corroboration, append the anchor's provenance).
//  - NEGATIVE anchor (vulnerable / deprecated / NON raccomandato) → DOWNGRADE:
//    the web may hype a package that Tier-A says is unsafe. Security truth wins.
//
// Pure + side-effect-free → unit-testable without the network.

import type { VoyagerClaim } from './types.js'

/** An identifying token a Tier-A/B claim asserts (a package or repo name). */
export interface CrossRefAnchor {
  token: string
  /** False when Tier-A flagged it (vuln/deprecated/not-found). */
  positive: boolean
  source: string
  provenance: VoyagerClaim['provenance']
}

/** Extract anchors from the non-Tier-C claims already in the brief. */
export function anchorsFromClaims(claims: VoyagerClaim[]): CrossRefAnchor[] {
  const anchors: CrossRefAnchor[] = []
  for (const c of claims) {
    if (c.provenance.some((p) => p.tier === 'C')) continue // only A/B anchor
    const d = c.data ?? {}
    const token = (typeof d.name === 'string' && d.name) || (typeof d.fullName === 'string' && d.fullName) || ''
    // Short names (ms, qs, fs) false-match unrelated prose — too weak to anchor.
    if (token.length < 4) continue
    const positive = d.recommended !== false && d.archived !== true
    anchors.push({ token, positive, source: c.provenance[0]?.source ?? 'tier-A', provenance: c.provenance })
  }
  return anchors
}

function mentions(statement: string, token: string): boolean {
  // Word-boundary-ish match, case-insensitive. Package names can contain
  // regex-special chars (@, /, .) so escape before building the test.
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(statement)
}

/**
 * Cross-reference web (Tier-C) claims against A/B anchors. Returns a NEW array;
 * non-web claims pass through untouched. Each web claim is upgraded (positive
 * anchor), downgraded (negative anchor), or left unconfirmed (no anchor).
 */
export function crossReferenceClaims(claims: VoyagerClaim[]): VoyagerClaim[] {
  const anchors = anchorsFromClaims(claims)
  if (!anchors.length) return claims

  return claims.map((c) => {
    const isWeb = c.provenance.length > 0 && c.provenance.every((p) => p.tier === 'C')
    if (!isWeb) return c
    const hit = anchors.find((a) => mentions(c.statement, a.token))
    if (!hit) return c

    if (hit.positive) {
      return {
        ...c,
        confidence: Math.min(0.7, Math.max(c.confidence, 0.6)),
        provenance: [...c.provenance, ...hit.provenance],
        warning: `cross-referenced with ${hit.source} (Tier-A confirms "${hit.token}")`,
        data: { ...(c.data ?? {}), crossReferencedBy: hit.source, crossRefToken: hit.token },
      }
    }
    // Negative: Tier-A contradicts the web. Security/quality truth wins.
    return {
      ...c,
      confidence: Math.min(c.confidence, 0.25),
      provenance: [...c.provenance, ...hit.provenance],
      warning: `⚠ the web cites "${hit.token}" but ${hit.source} (Tier-A) flags it NOT recommended`,
      data: { ...(c.data ?? {}), contradictedBy: hit.source, crossRefToken: hit.token },
    }
  })
}
